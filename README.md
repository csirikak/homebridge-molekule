<p align="center">
  <a href="https://molekule.com"><img src="https://github.com/csirikak/homebridge-molekule/assets/32028457/9736d1ff-ddcc-4f9d-87c9-dc6607a1ec29" height="140"></a>
</p>
<span align="center">
  
# homebridge-molekule
<a href="https://www.npmjs.com/package/homebridge-molekule"><img title="npm version" src="https://badgen.net/npm/v/homebridge-molekule?label=stable"></a>
<a href="https://github.com/csirikak/homebridge-molekule/tree/test"><img title="npm version" src="https://badgen.net/npm/v/homebridge-molekule/alpha?label=alpha"></a>
<a href="https://www.npmjs.com/package/homebridge-molekule"><img title="npm downloads" src="https://badgen.net/npm/dt/homebridge-molekule"></a>
</span>

<span align="left">

A Homebridge Plugin for Molekule Air Purifiers. Once you install this plugin you can say:

```
Hey Siri, what's the status of the Air Purifier Filter?
Hey Siri, set the speed of the Molekule to 60%.
Hey Siri, what's the air quality in the Living Room?
```

## Installation

Search for Molekule under Plugins in the Homebridge UI.
Or, copy and paste the following into a terminal

```bash
npm -g i homebridge-molekule
```

## Configuration

It should be configurable in plugin settings using homebridge-ui-x, if not, add this to your config.json file under Platforms.

```json
{
  "platform": "Molekule",
  "name": "homebridge-molekule",
  "email": "YOUR EMAIL HERE",
  "password": "YOUR PASSWORD HERE",
  "threshold": 10,
  "excludeAirMiniPlus": false,
  "silentAuto": false
}
```

- `threshold` sets the percentage at which a filter change warning is dislayed in the home app
- `excludeAirMiniPlus` disables Air Mini+ so you can use their native HomeKit function
- `silentAuto` default auto state on the Air Pro, silent (true) or standard (false)
- `AQIseparate` reports AQI and humidity as a separate accessory so that the data is present in the home overview
# v1.4.1
- renamed `normal` to `standard`
- added `AQIseparate` switch to separate humidity and AQI reporting
- minor bug fixes

# Notes and Issues

Using an incorrect password can cause a need for a full password reset on your account. Pay special attention to the password you're using.
This plugin loads the names that are set for each device in the Molekule app.
</span>
