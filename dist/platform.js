"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MolekuleHomebridgePlatform = void 0;
const settings_1 = require("./settings");
const platformAccessory_1 = require("./platformAccessory");
const cognito_1 = require("./cognito");
const devices_json_1 = require("./devices.json");
let intervalID;
const Models = devices_json_1.models;
const refreshInterval = 60; //token refresh interval in minutes
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
class MolekuleHomebridgePlatform {
    constructor(log, config, api, requester = new cognito_1.HttpAJAX(log, config)) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.requester = requester;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        // this is used to track restored cached accessories
        this.accessories = [];
        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on("didFinishLaunching", () => {
            log.debug("Executed didFinishLaunching callback");
            // run the method to discover / register your devices as accessories
            this.discoverDevices();
            if (!intervalID)
                intervalID = setInterval(() => this.requester.refreshIdToken(), refreshInterval * 60 * 1000);
        });
        this.log.debug("Finished initializing platform ", settings_1.PLATFORM_NAME);
    }
    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory) {
        this.log.info("Loading accessory from cache:", accessory.displayName);
        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }
    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    async discoverDevices() {
        this.log.debug("Discover Devices Called");
        const response = this.requester.httpCall("GET", "", "", 1);
        // loop over the discovered devices and register each one if it has not already been registered
        if ((await response).status !== 200) {
            this.log.error("Fatal error, discover devices failed. HTTP Status code: " + (await response).status + " Response: " + JSON.stringify((await response).body));
            return; //prevent crashes
        }
        const devicesQuery = await (await response).json();
        this.log.debug(JSON.stringify(devicesQuery));
        devicesQuery.content.forEach((device) => {
            var _a, _b;
            // generate a unique id for the accessory this should be generated from
            // something globally unique, but constant, for example, the device serial
            // number or MAC address
            this.log.debug("found device from API: " + JSON.stringify(device));
            const uuid = this.api.hap.uuid.generate(device.serialNumber);
            // see if an accessory with the same uuid has already been registered and restored from
            // the cached devices we stored in the `configureAccessory` method above
            const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);
            if (this.config.excludeAirMiniPlus && device.model === "Air Mini Pro") {
                this.log.info("Excluding Air Mini+ device: ", device.name);
                if (existingAccessory) {
                    this.log.warn("Removing accessory:", existingAccessory.context.device.name);
                    this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                        existingAccessory,
                    ]);
                }
            }
            else if (existingAccessory) {
                // the accessory already exists
                this.log.info("Restoring existing accessory from cache:", existingAccessory.displayName);
                // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
                // existingAccessory.context.device = device;
                // this.api.updatePlatformAccessories([existingAccessory]);
                // create the accessory handler for the restored accessory
                // this is imported from `platformAccessory.ts`
                existingAccessory.context.device.capabilities = Models[device.model];
                this.api.updatePlatformAccessories([existingAccessory]);
                new platformAccessory_1.MolekulePlatformAccessory(this, existingAccessory, this.config, this.log, this.requester);
                // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
                // remove platform accessories when no longer present
                // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
                // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
            }
            else {
                // the accessory does not yet exist, so we need to create it
                this.log.info("Adding new accessory:", device.name);
                // create a new accessory
                const accessory = new this.api.platformAccessory(device.name, uuid);
                // store a copy of the device object in the `accessory.context`
                // the `context` property can be used to store any data about the accessory you may need
                device.capabilities = Models[device.model];
                if (!device.capabilities) {
                    this.log.info("The device", device.name, "is not a known model. Using default values.");
                }
                if ((_b = (_a = device.capabilities) === null || _a === void 0 ? void 0 : _a.AutoFunctionality) !== null && _b !== void 0 ? _b : false) {
                    device.capabilities.AutoFunctionality = 0;
                }
                accessory.context.device = device;
                // create the accessory handler for the newly create accessory
                // this is imported from `platformAccessory.ts`
                new platformAccessory_1.MolekulePlatformAccessory(this, accessory, this.config, this.log, this.requester);
                // link the accessory to your platform
                this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                    accessory,
                ]);
            }
        });
        this.accessories.forEach((accessory) => {
            var _a;
            if ((_a = !devicesQuery.content.find((device) => this.api.hap.uuid.generate(device.serialNumber) === accessory.UUID)) !== null && _a !== void 0 ? _a : true) {
                this.log.warn("Removing accessory:", accessory.context.device.name);
                this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [
                    accessory,
                ]);
            }
        });
    }
}
exports.MolekuleHomebridgePlatform = MolekuleHomebridgePlatform;
//# sourceMappingURL=platform.js.map