# SOMA Blind Controller Util
Util for controlling SOMA smart shade, either over MQTT or via a HTTP API

# Requirements
- SOMA smart shade device
- Bluetooth 4.0 LE hardware
- OS supported by [noble](https://github.com/noble/noble) (I've only tested on macOS)
- Node (at a guess... some recent version, I'm testing with 9.3.0 installed)

# Installation
Run `npm install -g soma-ctrl`

# Usage
`somactrl` by itself will print usage information

By default, device scanning will be active for 30 seconds, and any supported ones will be connected to.
You may optionally:
- Alter the device scanning timeout, e.g. scan for 60 seconds: `somactrl -t 60`
- Specify the number of devices you expect to connect to, e.g. 4 devices expected: `somactrl -e 4`
- Manually specify a list of device IDs to connect to, e.g. connect to RISE108 and RISE117: `somactrl RISE108 RISE117`


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
    "state_topic": "homeassistant/cover/RISE148/position",
    "availability_topic": "homeassistant/cover/RISE148/connection",
    "payload_available": "connected",
    "payload_not_available": "disconnected",
    "set_position_topic": "homeassistant/cover/RISE148/move",
    "command_topic": "homeassistant/cover/RISE148/move",
    "payload_open": "100",
    "payload_close": "0"
}
```
To automatically setup a battery sensor:
`<baseTopic>/sensor/cover_<deviceName|slugified>_battery/config` will be set to, e.g.:
```
{
    "name": "Cover <deviceID> battery",
    "state_topic": "<baseTopic>/cover/<deviceID>/battery",
    "unit_of_measurement": "%"
}
```

## Parameters

`<deviceID>` has format `RISEnnn` and cannot be changed

`<deviceName|slugified` will be the device name (as configured in the app) with spaces replaced by underscores


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

## Parameters

`<deviceID>` has format `RISEnnn` and cannot be changed

`<position>` should be an integer between 0 (closed) and 100 (open)
