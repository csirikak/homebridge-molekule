import { Service, PlatformAccessory, CharacteristicValue, Logger, PlatformConfig } from "homebridge";
import { HttpAJAX } from "./cognito";
import { MolekuleHomebridgePlatform, queryResponse } from "./platform";
import { aqiReport } from "./aqi"

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class MolekulePlatformAccessory {
  private service: Service;
  static query: queryResponse = {
    content: [],
    requestTime: 0,
    change: false
  }
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
  private readonly aqiClass = new aqiReport(this.log, this.requester)

  constructor(
    private readonly platform: MolekuleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly config: PlatformConfig,
    private readonly log: Logger,
    private readonly requester: HttpAJAX,
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
    switch(this.accessory.context.device.capabilities.AirQualityMonitor){
      case 1:
        this.service.getCharacteristic(this.platform.Characteristic.AirQuality).onGet(this.getAirQuality.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.PM2_5Density);
        this.service.getCharacteristic(this.platform.Characteristic.PM10Density);
        this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity);
        this.service.getCharacteristic(this.platform.Characteristic.CarbonDioxideLevel);
        this.service.getCharacteristic(this.platform.Characteristic.VOCDensity);
        break;
      case 2:
        this.service.getCharacteristic(this.platform.Characteristic.AirQuality).onGet(this.getAirQuality.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.PM2_5Density);
        break;
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
  async updateAirQuality() {
    const AQIstats = await this.aqiClass.getAqi(this.accessory.context.device.serialNumber);
    switch(this.accessory.context.device.capabilities.AirQualityMonitor){
      case 1:
        this.service.updateCharacteristic(this.platform.Characteristic.PM2_5Density, AQIstats["PM2_5"] ?? 0);
        this.service.updateCharacteristic(this.platform.Characteristic.PM10Density, AQIstats["PM10"] ?? 0);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, AQIstats["RH"]) ?? 0;
        this.service.updateCharacteristic(this.platform.Characteristic.CarbonDioxideLevel, AQIstats["CO2"] ?? 0);
        this.service.updateCharacteristic(this.platform.Characteristic.VOCDensity, AQIstats["TVOC"] ?? 0);
        break;
      case 2:
        this.service.updateCharacteristic(this.platform.Characteristic.PM2_5Density, AQIstats["PM2_5"] ?? 0);
        break;
    }

  }
  async getAirQuality() {
    this.updateAirQuality();
    return this.state.airQuality;
  }
  async handleActiveSet(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    let data = '"on"}';
    if (!value) data = '"off"}';
    const response = await this.requester.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/set-power-status", '{"status":' + data, 1);
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
    MolekulePlatformAccessory.query.change = true;
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
    this.platform.log.debug(this.accessory.context.device.name + " state is: " + this.state.On);
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
        if (value === 1) responseCode = (await this.requester.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/enable-smart-mode", "", 1)).status;
        else {
          responseCode = (await this.requester.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/set-fan-speed", '{"fanSpeed": ' + clamp + "}", 1)).status;
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
        }
        break;
      case 2:
        if (value === 1) responseCode = (await this.requester.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/enable-smart-mode", '{"silent": "' + ((this.config.silentAuto ?? 0) as number) + '"}', 1)).status
        else {
          responseCode = (await this.requester.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/set-fan-speed", '{"fanSpeed": ' + clamp + "}", 1)).status;
          this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
        }
        break;
      default:
        this.log.error("Homekit attempted to set auto/manual (" + value + ") state but your device doesn't support it ☹");
        this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, 0);
        break;
    }
    if (responseCode === 204) {
      this.state.auto = value as number;
      this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.state.auto);
      this.platform.log.info(this.accessory.context.device.name, "set", value? "auto" : "manual", "state.");
      MolekulePlatformAccessory.query.change = true;
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
      (await this.requester.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/set-fan-speed", '{"fanSpeed": ' + clamp + "}", 1)).status ===
      204
    )
      this.state.Speed = clamp * 100/this.maxSpeed;
    this.platform.log.info(this.accessory.context.device.name + " set speed -> ", '{"fanSpeed":' + clamp + "}");
    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
    MolekulePlatformAccessory.query.change = true;
    this.updateStates();
  }

  async getSpeed(): Promise<CharacteristicValue> {
    return this.state.Speed;
  }

  async getFilterChange(): Promise<CharacteristicValue> {
    if (this.state.Filter > this.config.threshold) return 0;
    else return 1;
  }

  async getFilterStatus(): Promise<CharacteristicValue> {
    this.platform.log.debug(this.accessory.context.device.name, "Filter State:" , this.state.Filter);

    return this.state.Filter;
  }

  async updateStates() {
    if (MolekulePlatformAccessory.query.change || ((Date.now() - MolekulePlatformAccessory.query.requestTime) > 5000)){
      const re = await this.requester.httpCall("GET", "", "", 1);
      MolekulePlatformAccessory.query = await re.json();
      MolekulePlatformAccessory.query.requestTime = Date.now();
      MolekulePlatformAccessory.query.change = false;
    }
    else this.platform.log.debug("saved a request");
    if (MolekulePlatformAccessory.query.content === undefined) throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    for (let i = 0; i < Object.keys(MolekulePlatformAccessory.query.content).length; i++) {
      if (MolekulePlatformAccessory.query.content[i].serialNumber === this.accessory.context.device.serialNumber) {
        this.platform.log.debug(this.accessory.context.device.name, "speed is:", MolekulePlatformAccessory.query.content[i].fanspeed);
        this.state.Speed = (MolekulePlatformAccessory.query.content[i].fanspeed as unknown as number) * 100/this.maxSpeed;
        this.state.Filter = MolekulePlatformAccessory.query.content[i].pecoFilter as unknown as number;
        this.state.auto = +!!(MolekulePlatformAccessory.query.content[i].mode === "smart") //+!! cast boolean to number
        this.platform.log.debug(this.accessory.context.device.name, "auto/manual:", this.state.auto? "auto" : "manual")
        switch (MolekulePlatformAccessory.query.content[i].aqi){
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

        if (MolekulePlatformAccessory.query.content[i].online === "false") {
          this.platform.log.error(this.accessory.context.device.name + " was reported to be offline by the Molekule API.");
          throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
        if (MolekulePlatformAccessory.query.content[i].mode !== "off") {
          this.state.On = 1;
          this.state.state = 2;
        } else {
          this.state.On = 0;
          this.state.state = 0;
        }
      }
    }
    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, this.state.state);
    this.service.updateCharacteristic(this.platform.Characteristic.Active, this.state.On);
    if (this.accessory.context.device.AutoFunctionality != 0) this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.state.auto)
    return 0;
  }
}
