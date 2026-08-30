/**
 * Shared type definitions for the Molekule Homebridge plugin.
 */

/** Per-model capability flags sourced from devices.json. */
export interface capabilities {
  MaxFanSpeed: number;
  AutoFunctionality: number;
  AirQualityMonitor: number;
}

/** A single device as returned by the Molekule API (and cached in accessory context). */
export interface deviceData {
  name: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  auto: string;
  pecoFilter: string;
  fanspeed: string;
  mode: string;
  online: string;
  aqi: string;
  silent: string;
  capabilities: capabilities;
}

/** Response shape for the device-list query, plus the local caching metadata. */
export interface queryResponse {
  content: deviceData[];
  requestTime: number;
  change: boolean;
}

/** Map of model name -> capabilities, as stored in devices.json. */
export interface JsonData {
  [deviceName: string]: capabilities;
}

/** A single pollutant time series from the sensordata endpoint. */
export interface aqiType {
  type: string;
  sensorDataValue: {
    t: number | string;
    v: number;
  }[];
}

/** Response shape for the sensordata endpoint. */
export interface sensorDataResponse {
  message?: string;
  sensorData?: aqiType[];
}
