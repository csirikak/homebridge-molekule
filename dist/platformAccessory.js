"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MolekulePlatformAccessory = void 0;
const aqiReport_1 = require("./aqiReport");
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
class MolekulePlatformAccessory {
    constructor(platform, accessory, config, log, requester) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        this.platform = platform;
        this.accessory = accessory;
        this.config = config;
        this.log = log;
        this.requester = requester;
        /**
         * These are just used to create a working example
         * You should implement your own code to track the state of your accessory
         */
        this.maxSpeed = (_b = (_a = this.accessory.context.device.capabilities) === null || _a === void 0 ? void 0 : _a.MaxFanSpeed) !== null && _b !== void 0 ? _b : 6; //defaults to max speed of 6 if device not in JSON
        this.state = {
            state: 0,
            Speed: 0,
            Filter: 100,
            On: 0,
            auto: 0,
            airQuality: 0,
        };
        this.aqiClass = new aqiReport_1.aqiReport(this.requester);
        // set accessory information
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, "Molekule")
            .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.model)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.serialNumber)
            .setCharacteristic(this.platform.Characteristic.FirmwareRevision, accessory.context.device.firmwareVersion);
        // clear the AirPurifier service if it exists, and create a new AirPurifier service
        // you can create multiple services for each accessory
        // clearing needed to simplify handling of service split function.
        if ((_c = this.accessory.getService(this.platform.Service.AirPurifier)) !== null && _c !== void 0 ? _c : false) {
            this.accessory.removeService(this.accessory.getService(this.platform.Service.AirPurifier));
        }
        this.service = this.accessory.addService(this.platform.Service.AirPurifier);
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
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentAirPurifierState)
            .onGet(this.getState.bind(this)); // GET - bind to the `getState` method below
        // register handlers for the TargetAirPurifierState Characteristic
        if (this.accessory.context.device.capabilities.AutoFunctionality) {
            this.service
                .getCharacteristic(this.platform.Characteristic.TargetAirPurifierState)
                .onSet(this.handleAutoSet.bind(this))
                .onGet(this.handleAutoGet.bind(this));
        }
        this.service
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onSet(this.setSpeed.bind(this))
            .onGet(this.getSpeed.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
            .onGet(this.getFilterChange.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
            .onGet(this.getFilterStatus.bind(this));
        this.aqiService = this.service;
        this.humidityService = this.service;
        if (((_d = this.config.AQIseparate) !== null && _d !== void 0 ? _d : false) && ((_f = (_e = this.accessory.context.device.capabilities) === null || _e === void 0 ? void 0 : _e.AirQualityMonitor) !== null && _f !== void 0 ? _f : false)) {
            this.aqiService = this.accessory.getService(this.platform.Service.AirQualitySensor) ||
                this.accessory.addService(this.platform.Service.AirQualitySensor);
        }
        else {
            if ((_g = this.accessory.getService(this.platform.Service.AirQualitySensor)) !== null && _g !== void 0 ? _g : false) {
                this.accessory.removeService(this.accessory.getService(this.platform.Service.AirQualitySensor));
            }
            if ((_h = this.accessory.getService(this.platform.Service.HumiditySensor)) !== null && _h !== void 0 ? _h : false) {
                this.accessory.removeService(this.accessory.getService(this.platform.Service.HumiditySensor));
            }
        }
        switch (this.accessory.context.device.capabilities.AirQualityMonitor) {
            case 1:
                this.aqiService
                    .getCharacteristic(this.platform.Characteristic.AirQuality)
                    .onGet(this.getAirQuality.bind(this));
                this.aqiService.getCharacteristic(this.platform.Characteristic.PM2_5Density);
                this.aqiService.getCharacteristic(this.platform.Characteristic.PM10Density);
                this.aqiService.getCharacteristic(this.platform.Characteristic.CarbonDioxideLevel);
                this.aqiService.getCharacteristic(this.platform.Characteristic.VOCDensity);
                if ((_j = this.config.AQIseparate) !== null && _j !== void 0 ? _j : false) {
                    this.humidityService = this.accessory.getService(this.platform.Service.HumiditySensor) ||
                        this.accessory.addService(this.platform.Service.HumiditySensor);
                }
                this.humidityService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity);
                break;
            case 2:
                this.aqiService
                    .getCharacteristic(this.platform.Characteristic.AirQuality)
                    .onGet(this.getAirQuality.bind(this));
                this.aqiService.getCharacteristic(this.platform.Characteristic.PM2_5Density);
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
        var _a, _b, _c, _d, _e, _f;
        const AQIstats = await this.aqiClass.getAqi(this.accessory.context.device.serialNumber);
        this.log.debug(this.accessory.context.device.name, AQIstats);
        switch (this.accessory.context.device.capabilities.AirQualityMonitor) {
            case 1:
                this.aqiService.updateCharacteristic(this.platform.Characteristic.PM2_5Density, (_a = AQIstats["PM2_5"]) !== null && _a !== void 0 ? _a : 0);
                this.aqiService.updateCharacteristic(this.platform.Characteristic.PM10Density, (_b = AQIstats["PM10"]) !== null && _b !== void 0 ? _b : 0);
                this.humidityService.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, (_c = AQIstats["RH"]) !== null && _c !== void 0 ? _c : 0);
                this.aqiService.updateCharacteristic(this.platform.Characteristic.CarbonDioxideLevel, (_d = AQIstats["CO2"]) !== null && _d !== void 0 ? _d : 0);
                this.aqiService.updateCharacteristic(this.platform.Characteristic.VOCDensity, (_e = AQIstats["TVOC"]) !== null && _e !== void 0 ? _e : 0);
                break;
            case 2:
                this.aqiService.updateCharacteristic(this.platform.Characteristic.PM2_5Density, (_f = AQIstats["PM2_5"]) !== null && _f !== void 0 ? _f : 0);
        }
    }
    getAirQuality() {
        this.updateAirQuality();
        return this.state.airQuality;
    }
    async handleActiveSet(value) {
        // implement your own code to turn your device on/off
        let data = '"on"}';
        if (!value)
            data = '"off"}';
        const response = await this.requester.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/set-power-status", '{"status":' + data, 1);
        if (response.status === 204) {
            this.platform.log.info("Attempted to set: " +
                value +
                " state on device: " +
                this.accessory.context.device.name +
                " Server Reply: " +
                JSON.stringify(response));
            this.service.updateCharacteristic(this.platform.Characteristic.Active, value);
            if (value) {
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, 2);
                this.state.state = 2;
                this.state.On = 1;
            }
            else {
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
    handleActiveGet() {
        this.updateStates();
        if (!+this.accessory.context.device.online) {
            throw new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
        }
        return this.state.On;
        // if you need to return an error to show the device as "Not Responding" in the Home app:
        // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    getState() {
        return this.state.state;
    }
    async handleAutoSet(value) {
        var _a;
        let responseCode;
        const clamp = Math.round(Math.min(Math.max(this.state.Speed / (100 / this.maxSpeed), 1), this.maxSpeed));
        switch (this.accessory.context.device.capabilities.AutoFunctionality) {
            case 1:
                if (value === 1)
                    responseCode = (await this.requester.httpCall("POST", this.accessory.context.device.serialNumber +
                        "/actions/enable-smart-mode", "", 1)).status;
                else {
                    responseCode = (await this.requester.httpCall("POST", this.accessory.context.device.serialNumber +
                        "/actions/set-fan-speed", '{"fanSpeed": ' + clamp + "}", 1)).status;
                    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
                }
                break;
            case 2:
                if (value === 1)
                    responseCode = (await this.requester.httpCall("POST", this.accessory.context.device.serialNumber +
                        "/actions/enable-smart-mode", '{"silent": "' + +((_a = this.config.silentAuto) !== null && _a !== void 0 ? _a : 0) + '"}', 1)).status;
                else {
                    responseCode = (await this.requester.httpCall("POST", this.accessory.context.device.serialNumber +
                        "/actions/set-fan-speed", '{"fanSpeed": ' + clamp + "}", 1)).status;
                    this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
                }
                break;
            default:
                this.log.error("Homekit attempted to set auto/manual (" +
                    value +
                    ") state but your device doesn't support it ☹");
                this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, 0);
                break;
        }
        if (responseCode === 204 || responseCode === 200) {
            this.state.auto = value;
            this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.state.auto);
            this.platform.log.info(this.accessory.context.device.name, "set", value ? "auto" : "manual", "state.");
            MolekulePlatformAccessory.query.change = true;
        }
        else {
            this.log.error(this.accessory.context.device.name, "failed to set auto/manual state");
            this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.state.auto);
        }
    }
    handleAutoGet() {
        return this.state.auto;
    }
    /**
     * Handle "SET" requests from HomeKit
     * These are sent when the user changes the state of an accessory, for example, changing the speed
     */
    async setSpeed(value) {
        const clamp = Math.round(Math.min(Math.max(value / (100 / this.maxSpeed), 1), this.maxSpeed));
        if ((await this.requester.httpCall("POST", this.accessory.context.device.serialNumber + "/actions/set-fan-speed", '{"fanSpeed": ' + clamp + "}", 1)).status === 204)
            this.state.Speed = (clamp * 100) / this.maxSpeed;
        this.platform.log.info(this.accessory.context.device.name + " set speed -> ", '{"fanSpeed":' + clamp + "}");
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
        MolekulePlatformAccessory.query.change = true;
        this.updateStates();
    }
    getSpeed() {
        return this.state.Speed;
    }
    getFilterChange() {
        var _a;
        if ((_a = this.state.Filter > this.config.threshold) !== null && _a !== void 0 ? _a : 10)
            return 0;
        else
            return 1;
    }
    getFilterStatus() {
        this.platform.log.debug(this.accessory.context.device.name, "Filter State:", this.state.Filter);
        return this.state.Filter;
    }
    async updateStates() {
        if (MolekulePlatformAccessory.query.change ||
            Date.now() - MolekulePlatformAccessory.query.requestTime > 5000) {
            const re = await this.requester.httpCall("GET", "", "", 1);
            MolekulePlatformAccessory.query = await re.json();
            MolekulePlatformAccessory.query.requestTime = Date.now();
            MolekulePlatformAccessory.query.change = false;
        }
        else
            this.platform.log.debug("saved a request");
        if (MolekulePlatformAccessory.query.content === undefined)
            this.accessory.context.device.offline = true;
        for (let i = 0; i < Object.keys(MolekulePlatformAccessory.query.content).length; i++) {
            if (MolekulePlatformAccessory.query.content[i].serialNumber ===
                this.accessory.context.device.serialNumber) {
                MolekulePlatformAccessory.query.content[i].capabilities = this.accessory.context.device.capabilities;
                this.accessory.context.device = MolekulePlatformAccessory.query.content[i];
                this.platform.log.debug(this.accessory.context.device.name, "speed is:", this.accessory.context.device.fanspeed);
                this.state.Speed =
                    ((+this.accessory.context.device.fanspeed) *
                        100) /
                        this.maxSpeed;
                this.state.Filter = +this.accessory.context.device.pecoFilter;
                this.state.auto = +(this.accessory.context.device.mode === "smart"); //+ cast boolean to number
                this.platform.log.debug(this.accessory.context.device.name, "auto/manual:", this.state.auto ? "auto" : "manual");
                switch (this.accessory.context.device.aqi) {
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
                if (this.accessory.context.device.online === "false") {
                    this.platform.log.warn(this.accessory.context.device.name +
                        " was reported to be offline by the Molekule API.");
                    this.accessory.context.device.online = false;
                }
                else {
                    this.accessory.context.device.online = true;
                }
                if (this.accessory.context.device.mode !== "off") {
                    this.state.On = 1;
                    this.state.state = 2;
                }
                else {
                    this.state.On = 0;
                    this.state.state = 0;
                }
                this.log.debug(this.accessory.context.device.name, this.state);
            }
        }
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.state.Speed);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentAirPurifierState, this.state.state);
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.state.On);
        if (this.accessory.context.device.AutoFunctionality != 0)
            this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, this.state.auto);
    }
}
exports.MolekulePlatformAccessory = MolekulePlatformAccessory;
MolekulePlatformAccessory.query = {
    content: [],
    requestTime: 0,
    change: false,
};
//# sourceMappingURL=platformAccessory.js.map