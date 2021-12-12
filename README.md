# SOMA Blind Controller Util [![npm version](https://badge.fury.io/js/soma-ctrl.svg)](https://badge.fury.io/js/soma-ctrl)
Util for controlling SOMA smart shade, either over MQTT or via a HTTP API

# Requirements
- SOMA smart shade device that has been configured with the SOMA app
- Bluetooth 4.0 LE hardware
- OS supported by [noble](https://github.com/abandonware/noble) (I've only tested on macOS and Raspbian)
- Node 8.16.1 or higher (Tested on Node 12.10.0, 11.15.0, 10.15.2, 9.11.2, 8.16.1)
- (Potentially a Bluetooth stick to itself, if you're using some other Bluetooth software, see [#59](https://github.com/andersonshatch/soma-ctrl/issues/59#issuecomment-497662843))

# Installation
Run `npm install -g soma-ctrl`

## Run as a SystemD service

Test your command with all options and be sure everything work as expected before trying the systemd configuration, once confirmed, create the service file:
`vi /etc/systemd/system/soma-ctrl.service`

and add this to the file:

```
[Unit]
Description=soma-ctrl service
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=soma-ctrl
WorkingDirectory=/home/soma-ctrl/
ExecStart=/usr/bin/node /usr/local/bin/somactrl -d -t TIMEOUT -e NUMBEROFDEVICEEXPECTED --url mqtt://IP/FQDN -u "MQTTUSER" -p "MQTTPASSWORD"

[Install]
WantedBy=multi-user.target
```
Type "i" to enter insert mode and ESC and "wq" to save and quit vi. 
Replace TIMEOUT,NUMBEROFDEVICEEXPECTED,IP/FQDN,MQTTUSER and MQTTPASSWORD with your configurations.
Replace "User=soma-ctrl" with your user. If you want to run as non-root user check: https://github.com/noble/noble#running-on-linux Good practice is to create a user specific for this service.

When this service file is modified, you have to run this to make the change effective:
`sudo systemctl daemon-reload`

Starting service: `$ sudo systemctl start soma-ctrl`
Stopping service: `$ sudo systemctl stop soma-ctrl`
Get status: `$ sudo systemctl status soma-ctrl`

In case of problem, add the "-d" flag to somactrl and look in journalctl:
`journalctl -fu soma-ctrl`


# Usage
`somactrl` by itself will print usage information

By default, device scanning will be active for 30 seconds, and any supported ones will be connected to.
You may optionally:
- Alter the device scanning timeout, e.g. scan for 60 seconds: `somactrl -t 60`
- Specify the number of devices you expect to connect to, e.g. 4 devices expected: `somactrl -e 4`
- Manually specify a list of device IDs to connect to, e.g. connect to RISE108 and RISE117: `somactrl RISE108 RISE117`
- Manually specify a list of MAC addresses to connect to, e.g.: `somactrl f5:11:7b:ee:f3:43`


You must then specify options to use either MQTT, HTTP or both

## To use with HTTP
Specify a port for the API to listen on with `-l`:
`somactrl -l 3000`

## To use with MQTT
Specify a broker URL with `--url` option:
`somactrl --url mqtt://yourbroker` (mqtt/mqtts/ws/wss accepted)

Username and password for MQTT may be specified with `-u` and `-p` option

If no password argument is supplied, you can enter it interactively

Base topic defaults to `homeassistant`, but may be configured with the `-topic` option


# MQTT
For each device connected, data will be published to the following topics:
`<baseTopic>/cover/<deviceID>/position` - position

`<baseTopic>/cover/<deviceID>/connected` - `connected` or `disconnected`

`<baseTopic>/cover/<deviceID>/battery` - battery level

To issue commands:
Move: `<baseTopic>/cover/<deviceID>/move` - message: int position between 0 (closed) and 100 (open)

Stop: `<baseTopic>/cover/<deviceID>/move` - message: 'stop'

Identify (beep device): `<baseTopic>/cover/<deviceID/identify` - message is ignored

In addition, for use with [Home Assistant MQTT Discovery](https://www.home-assistant.io/docs/mqtt/discovery/):

To automatically setup the cover device:
`<baseTopic>/cover/<deviceID>/config` will be set to, e.g.:
```
{
    "name": "Living Room1",
    "availability_topic": "homeassistant/cover/RISE148/connection",
    "payload_available": "connected",
    "payload_not_available": "disconnected",
    "position_topic": "homeassistant/cover/RISE148/position",
    "set_position_topic": "homeassistant/cover/RISE148/move",
    "command_topic": "homeassistant/cover/RISE148/move",
    "payload_open": 100,
    "payload_close": 0,
    "unique_id": "soma_RISE148_cover",
    "device": {
        "identifiers": "soma_RISE148",
        "name": "RISE148",
        "manufacturer": "Soma",
        "model": "Smart Shade"
    }
}
```
To automatically setup a battery sensor:
`<baseTopic>/sensor/cover_<deviceName|slugified>_battery/config` will be set to, e.g.:
```
{
    "name": "Cover <deviceID> battery",
    "state_topic": "<baseTopic>/cover/<deviceID>/battery",
    "unit_of_measurement": "%",
    "device_class": "battery",
    "unique_id": "soma_<deviceID>_battery",
    "device": {
        "identifiers": "soma_RISE148",
        "name": "RISE148",
        "manufacturer": "Soma",
        "model": "Smart Shade"
    }
}
```

## Parameters

`<deviceID>` has format `RISEnnn` or the device's MAC address in lowercase, with the colon's stripped out and cannot be changed

`<deviceName|slugified>` will be the device name (as configured in the app) with spaces replaced by underscores


# HTTP Endpoints

`GET /`: list devices.
Response type: `[String : Device]` - ID as String key, Device as value
```
{
    "RISE148": {
        "id": "RISE148",
        "battery": 29,
        "batteryLevelLastChanged": "2018-05-03T17:14:10.590Z",
        "position": 0,
        "positionLastChanged": "2018-05-03T17:14:10.320Z",
        "connectionState": "connected",
        "state": "closed",
        "group": "Living Room",
        "name": "Living Room1"
    },
    "RISE236": {
        "id": "RISE236",
        "battery": 28,
        "batteryLevelLastChanged": "2018-05-03T17:14:10.497Z",
        "position": 0,
        "positionLastChanged": "2018-05-03T17:14:10.198Z",
        "connectionState": "connected",
        "state": "closed",
        "group": "Living Room",
        "name": "Living Room2"
    }
}
```

`GET /<deviceID>`: Get individual device data (or 404 if no device by that ID).

Response type: `Device` example:
```
{
    "id": "RISE148",
    "battery": 29,
    "batteryLevelLastChanged": "2018-05-03T17:14:10.590Z",
    "position": 0,
    "positionLastChanged": "2018-05-03T17:14:10.320Z",
    "connectionState": "connected",
    "state": "closed",
    "group": "Living Room",
    "name": "Living Room1"
}
```

`POST /<deviceID>/identify`: Ask deviceID to identify itself (beep). Response type: `200 - OK` or `404 - Not Found`

`POST /<deviceID>/move?position=<position>`: Ask deviceID to move to `<position>`. Response type: `Device` or `404`

`POST /<deviceID>/stop`: Ask deviceID to stop moving. Response type: `200 - OK` or `404 - Not Found`

`POST /<deviceID>/calibrateModeStart`: Enable calibrate mode on deviceID. Response type: `200 - OK` or `404 - Not Found`

`POST /<deviceID>/moveUp`: Request device to move up. Beware that if calibration mode is enabled, the defined top position is not honoured. Response type: `200 - OK` or `404 - Not Found`

`POST /<deviceID>/stop`: Request device to stop moving. Response type: `200 - OK` or `404 - Not Found`

`POST /<deviceID>/moveDown`: Request device to move down. Beware that if calibration mode is enabled, the defined bottom position is not honoured. Response type: `200 - OK` or `404 - Not Found`

`POST /<deviceID>/calibrateTop`: When in calibrate mode, set the current position as the top-most position. Response Type: `200 - OK` or `404 - Not Found`

`POST /<deviceID>/calibrateBottom`: When in calibrate mode, set the current position as the bottom-most position. Response Type: `200 - OK` or `404 - Not Found`

`POST /<deviceID>/calibrateModeStop`: Disable calibrate mode on deviceID. Response type; `200 - OK` or `404 - Not Found`

`POST /exit`: Quit somactrl (useful if you run with systemd and want to restart). Response type: `200 - OK`

## Parameters

`<deviceID>` has format `RISEnnn` or the device's MAC address in lowercase, with the colon's stripped out and cannot be changed

`<position>` should be an integer between 0 (closed) and 100 (open)
