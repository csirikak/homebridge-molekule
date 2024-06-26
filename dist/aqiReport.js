"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aqiReport = void 0;
class aqiReport {
    constructor(requester) {
        this.requester = requester;
    }
    async getAqi(serialNumber) {
        const extra = "/sensordata?aggregation=false&fromDate=" +
            (Date.now() - 1000 * 60 * 60) +
            "&resolution=5&toDate=" +
            Date.now();
        const response = await (await this.requester.httpCall("GET", serialNumber + extra, "", 1)).json();
        const data = {
            PM2_5: 0,
            PM10: 0,
            RH: 0,
            TVOC: 0,
            CO2: 0,
        };
        if (response === undefined || response.message == "Sensor data not found")
            throw new Error("Failed to get AQI data");
        else {
            response.sensorData.forEach((pollutant) => {
                for (let i = Object.keys(pollutant.sensorDataValue).length - 1; i >= 0; i--) {
                    if (pollutant.sensorDataValue[i].v !== -1) {
                        data[pollutant.type] = pollutant.sensorDataValue[i].v;
                        i = 0;
                    }
                }
            });
            return data;
        }
    }
}
exports.aqiReport = aqiReport;
//# sourceMappingURL=aqiReport.js.map