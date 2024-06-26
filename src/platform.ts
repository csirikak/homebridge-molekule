import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from "homebridge";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";
import { MolekulePlatformAccessory } from "./platformAccessory";
import { HttpAJAX } from "./cognito";
import { models } from "./devices.json";

export interface queryResponse {
  content: deviceData[];
  requestTime: number;
  change: boolean;
}
interface deviceData {
  name: string;
  model: string;
  serialNumber: string;
  auto: string;
  pecoFilter: string;
  fanspeed: string;
  mode: string;
  online: string;
  aqi: string;
  silent: string;
  capabilities: capabilities;
}
interface capabilities {
  MaxFanSpeed: number;
  AutoFunctionality: number;
  AirQualityMonitor: number;
}

interface JsonData {
  [deviceName: string]: capabilities;
}
let intervalID: NodeJS.Timer;
const Models: JsonData = models;
const refreshInterval = 60; //token refresh interval in minutes
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class MolekuleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
    public readonly requester = new HttpAJAX(log, config),
  ) {
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on("didFinishLaunching", () => {
      log.debug("Executed didFinishLaunching callback");
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
      if (!intervalID)
        intervalID = setInterval(
          () => this.requester.refreshIdToken(),
          refreshInterval * 60 * 1000,
        );
    });
    this.log.debug("Finished initializing platform ", PLATFORM_NAME);
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */

  configureAccessory(accessory: PlatformAccessory) {
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
      this.log.error(
        "Fatal error, discover devices failed. HTTP Status code: " + (await response).status + " Response: " + JSON.stringify((await response).body),
      );
      return; //prevent crashes
    }
    const devicesQuery: queryResponse = await (await response).json();
    this.log.debug(JSON.stringify(devicesQuery));
    devicesQuery.content.forEach((device: deviceData) => {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      this.log.debug("found device from API: " + JSON.stringify(device));
      const uuid = this.api.hap.uuid.generate(device.serialNumber);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid,
      );
      if (this.config.excludeAirMiniPlus && device.model === "Air Mini Pro") {
        this.log.info("Excluding Air Mini+ device: ", device.name);
        if (existingAccessory) {
          this.log.warn(
            "Removing accessory:",
            existingAccessory.context.device.name,
          );
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            existingAccessory,
          ]);
        }
      } else if (existingAccessory) {
        // the accessory already exists
        this.log.info(
          "Restoring existing accessory from cache:",
          existingAccessory.displayName,
        );

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        existingAccessory.context.device.capabilities = Models[device.model];
        this.api.updatePlatformAccessories([existingAccessory]);
        new MolekulePlatformAccessory(
          this,
          existingAccessory,
          this.config,
          this.log,
          this.requester,
        );

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info("Adding new accessory:", device.name);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.name, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        device.capabilities = Models[device.model];
        if (!device.capabilities) {
          this.log.info("The device", device.name, "is not a known model. Using default values.")
        }
        if (device.capabilities?.AutoFunctionality ?? false) {
          device.capabilities.AutoFunctionality = 0;
        }
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new MolekulePlatformAccessory(
          this,
          accessory,
          this.config,
          this.log,
          this.requester,
        );
        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    });
    this.accessories.forEach((accessory: PlatformAccessory) => {
      if (
        !devicesQuery.content.find(
          (device) =>
            this.api.hap.uuid.generate(device.serialNumber) === accessory.UUID,
        ) ??
        true
      ) {
        this.log.warn("Removing accessory:", accessory.context.device.name);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
      }
    });
  }
}
