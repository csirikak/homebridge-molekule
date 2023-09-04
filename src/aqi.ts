import { Logger } from "homebridge";
import { HttpAJAX } from "./cognito";

interface aqiType {
    type: string,
    sensorDataValue: [{
        t: number | string,
        v: number
    }]
}

export class aqiReport {
    
    constructor(
        private readonly log: Logger,
        private readonly requester: HttpAJAX,
    ){
    }
    async getAqi(serialNumber: string): Promise<Record<string, number>> {
        const extra = "/sensordata?aggregation=false&fromDate=" + (Date.now() - 1000 * 60 * 60)  + "&resolution=5&toDate=" + Date.now();
        const response = await (await this.requester.httpCall("GET", serialNumber + extra, '', 1)).json()
        const data: Record<string, number> = {
            'PM2_5': 0,
            'PM10': 0,
            'RH': 0,
            'TVOC': 0,
            'CO2': 0
        }
        if (response === undefined) throw new Error("Failed to get AQI data");
        else {
            response.sensorData.forEach((pollutant: aqiType) => {
                for (let i = Object.keys(pollutant.sensorDataValue).length - 1; i >= 0; i--){
                    if (pollutant.sensorDataValue[i].v !== -1){
                        data[pollutant.type] = pollutant.sensorDataValue[i].v
                        i = 0;
                    }
                }
            }); 
            this.log.debug(data as unknown as string);
            return data;
        }
    }
}