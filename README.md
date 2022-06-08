# homebridge-molekule
A Homebridge Plugin for Molekule Air Purifiers. Tested on the Air Mini. Once you install this plugin you can say:
```
Hey Siri, what's the status of the Air Purifier Filter?
Hey Siri, set the speed of the Molekule to 60%.
```
## Installation
Search for Molekule under Plugins in the Homebridge UI
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
  "threshold": 10
}
```
# Notes and Issues
Using an incorrect password can cause a need for a full password reset on your account. Pay special attention to the password you're using.
This plugin loads the names that are set for each device in the Molekule app. 
