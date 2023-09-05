import { Service, PlatformAccessory, CharacteristicValue, Logger, PlatformConfig } from "homebridge";
import { HttpAJAX } from "./cognito";
import { MolekuleHomebridgePlatform, queryResponse } from "./platform";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class MolekulePlatformAccessory {
  private service: Service;
  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private maxSpeed = this.accessory.context.device.capabilities.MaxFanSpeed ?? 6 //defaults to max speed of 6 if device not in JSON
  private state = {
    state: 0, //https://developers.homebridge.io/#/characteristic/CurrentAirPurifierState
    Speed: 0,
    Filter: 100,
    On: 0,
    auto: 0,
    airQuality: 0
  };

  constructor(
    private readonly platform: MolekuleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly config: PlatformConfig,
    private readonly log: Logger,
    private readonly caller: HttpAJAX,
    private deviceQuery: queryResponse,
  ) {
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, "Molekule")
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.serialNumber)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, accessory.context.device.firmwareVersion);

    // get the AirPurifier service if it exists, otherwise create a new AirPurifier service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.AirPurifier) || this.accessory.addService(this.platform.Service.AirPurifier);
    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/AirPurifier

    // register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.handleActiveSet.bind(this)) // SET - bind to the `handleActiveSet` method below
      .onGet(this.handleActiveGet.bind(this)); // GET - bind to the `handleActiveGet` method below
    // register handlers for the CurrentAirPurifierState Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.CurrentAirPurifierState).onGet(this.getState.bind(this)); // GET - bind to the `getState` method below
    // register handlers for the TargetAirPurifierState Characteristic
    if (this.accessory.context.device.capabilities.AutoFunctionality){
      this.service
        .getCharacteristic(this.platform.Characteristic.TargetAirPurifierState)
        .onSet(this.handleAutoSet.bind(this))
        .onGet(this.handleAutoGet.bind(this));
    }
    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed).onSet(this.setSpeed.bind(this)).onGet(this.getSpeed.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.FilterChangeIndication).onGet(this.getFilterChange.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.FilterLifeLevel).onGet(this.getFilterStatus.bind(this));
    if (this.accessory.context.device.capabilities.AirQualityMonitor) {
      this.service.getCharacteristic(this.platform.Characteristic.AirQuality).onGet(this.getAirQuality.bind(this));
    }
    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async getAirQuality() {
    return this.state.airQuality;
  }
  async handleActiveSet(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    let data = '"on"}';
    if (!value) data = '"off"}';
    const response = await this.caller.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/set-power-status", '{"status":' + data, 1);
    if (response.status === 204) {
      this.platform.log.info(
        "Attempted to set: " + value + " state on device: " + this.accessory.context.device.name + " Server Reply: " + JSON.stringify(response));
      this.service.updateCharacteristic(this.platform.Characteristic.Active, value);
      if (value) {
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, 2);
        this.state.state = 2;
        this.state.On = 1;
      } else {
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, 0);
        this.state.On = 0;
      }
    }
    this.deviceQuery.change = true;
    this.updateStates();
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience() in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.
   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async handleActiveGet(): Promise<CharacteristicValue> {
    this.updateStates()
    return this.state.On;
    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
  }

  async getState(): Promise<CharacteristicValue> {
    return this.state.state;
  }

  async handleAutoSet(value: CharacteristicValue) {
    let responseCode;
    const clamp = Math.round(Math.min(Math.max((this.state.Speed) / (100/this.maxSpeed), 1), this.maxSpeed));
    switch (this.accessory.context.device.capabilities.AutoFunctionality as number){
      case 1:
        if (value === 1) responseCode = (await this.caller.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/enable-smart-mode", "", 1)).status;
        else {
          responseCode = (await this.caller.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/set-fan-speed", '{"fanSpeed": ' + clamp + "}", 1)).status;
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
        }
        break;
      case 2:
        if (value === 1) responseCode = (await this.caller.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/enable-smart-mode", '{"silent": "' + (+(this.config.silentAuto ?? 0)) + '"}', 1)).status
        else {
          responseCode = (await this.caller.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/set-fan-speed", '{"fanSpeed": ' + clamp + "}", 1)).status;
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
        }
        break;
      default:
        this.log.error("Homekit attempted to set auto/manual (" + value + ") state but your device doesn't support it ☹");
        this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, 0);
        break;
    }
    if (responseCode === 204 || responseCode === 200) {
      this.state.auto = value as number;
      this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.state.auto);
      this.platform.log.info(this.accessory.context.device.name, "set", value? "auto" : "manual", "state.");
      this.deviceQuery.change = true;
    }
    else {
      this.log.error(this.accessory.context.device.name, "failed to set auto/manual state");
      this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.state.auto);
    }
  }

  async handleAutoGet() {
    return this.state.auto;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the speed
   */
  async setSpeed(value: CharacteristicValue) {
    const clamp = Math.round(Math.min(Math.max((value as number) / (100/this.maxSpeed), 1), this.maxSpeed));
    if (
      (await this.caller.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/set-fan-speed", '{"fanSpeed": ' + clamp + "}", 1)).status ===
      204
    )
      this.state.Speed = clamp * 100/this.maxSpeed;
    this.platform.log.info(this.accessory.context.device.name + " set speed -> ", '{"fanSpeed":' + clamp + "}");
    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
    this.deviceQuery.change = false;
    this.updateStates();
  }

  async getSpeed(): Promise<CharacteristicValue> {
    return this.state.Speed;
  }

  async getFilterChange(): Promise<CharacteristicValue> {
    if (this.state.Filter > this.config.threshold ?? 10) return 0;
    else return 1;
  }

  async getFilterStatus(): Promise<CharacteristicValue> {
    return this.state.Filter;
  }

  async updateStates() {
    if (Date.now() - this.deviceQuery.requestTime >= 1000 || this.deviceQuery.change){
      const re = await this.caller.httpCall("GET", "", "", 1);
      this.deviceQuery = await re.json();
      this.deviceQuery.requestTime = Date.now();
      this.deviceQuery.change = false;
    }
    if (this.deviceQuery === undefined) throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    for (let i = 0; i < Object.keys(this.deviceQuery.content).length; i++) {
      if (this.deviceQuery.content[i].serialNumber === this.accessory.context.device.serialNumber) {
        this.state.Speed = (this.deviceQuery.content[i].fanspeed as unknown as number) * 100/this.maxSpeed;
        this.state.Filter = this.deviceQuery.content[i].pecoFilter as unknown as number;
        this.state.auto = +!!(this.deviceQuery.content[i].mode === "smart") //+!! cast boolean to number
        switch (this.deviceQuery.content[i].aqi){
          case "good":
            this.state.airQuality = 1;
            break;
          case "moderate":
            this.state.airQuality = 3;
            break;
          case "bad":
            this.state.airQuality = 4;
            break;
          case "very bad":
            this.state.airQuality = 5;
            break;
          default:
            this.state.airQuality = 0;
            break;
        }

        if (this.deviceQuery.content[i].online === "false") {
          this.platform.log.error(this.accessory.context.device.name + " was reported to be offline by the Molekule API.");
          throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
        if (this.deviceQuery.content[i].mode !== "off") {
          this.state.On = 1;
          this.state.state = 2;
        } else {
          this.state.On = 0;
          this.state.state = 0;
        }
        this.log.debug(this.accessory.context.device.name, this.state);
        this.log.debug(this.deviceQuery.content[i].mode)
      }
    }
    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, this.state.state);
    this.service.updateCharacteristic(this.platform.Characteristic.Active, this.state.On);
    if (this.accessory.context.device.AutoFunctionality != 0) this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.state.auto)
    return 0;
  }
}
