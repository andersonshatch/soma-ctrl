#!/usr/bin/env node

const readlineSync = require('readline-sync');
const noble = require('noble');
const log = require('debug')('soma*');
const debugLog = require('debug')('soma');
const SomaShade = require('./src/SomaShade');

const yargs = require('yargs');
const args = yargs
    .usage('Usage: $0 --express-port 3000 --url [mqtt|ws][s]://yourbroker.example.com')
    .example('$0 -t 60 -l 3000', 'Scan for any devices for 60 seconds, bind webserver to port 3000')
    .example('$0 -e 2 -l 3000', 'Scan until 2 devices are connected and bind webserver to port 3000')
    .example('$0 RISE108 RISE117 -url [broker_url]', 'Connect to devices with specific IDs only, publish to MQTT')
    .options({
        't': {
            alias: 'discovery-timeout',
            describe: 'Number of seconds to scan for devices for (ignored if -e or explicit list of names is specified)',
            type: 'number',
            default: 30
        },
        'd': {
            alias: 'debug',
            describe: 'Enable debug logging',
            type: 'boolean'
        },
        'e': {
            alias: 'expected-devices',
            describe: 'Number of blind controller devices you expect to connect to, after which scanning will stop',
            type: 'number'
        },
        'l': {
            alias: 'express-port',
            describe: 'Port for express web server (if unset, express will not startup)',
            type: 'number',
        },
        'url': {
            alias: 'mqtt-url',
            describe: 'MQTT broker URL',
        },
        'topic': {
            alias: 'mqtt-base-topic',
            describe: 'Base topic for MQTT',
            default: 'homeassistant'
        },
        'p': {
            alias: 'mqtt-password',
            describe: 'Password for MQTT (if not specified as an argument, will prompt for password at startup)'
        },
        'u': {
            alias: 'mqtt-username',
            describe: 'Username for MQTT'
        }
    })
    .wrap(yargs.terminalWidth())
    .env('SOMA');

const argv = args.argv;

if (argv.debug) {debugLog.enabled = true;}

if (!argv.mqttUrl && !argv.expressPort) {
    log('ERROR: Neither --express-port or --mqtt-url supplied, nothing to do');
    yargs.showHelp();
    process.exit(-1);
}

if (argv.p === true) {
    argv.p = readlineSync.question('MQTT Password: ', {hideEchoBack: true, mask: ''});
}

const idsToConnectTo = argv._.filter(name => name.startsWith('RISE'));
const manualIdsWereSpecified = idsToConnectTo.length !== 0;
if (!manualIdsWereSpecified) {
    let message = 'No device names supplied, ';
    if (argv.expectedDevices) {
        message += 'will stop scanning after ' + argv.expectedDevices + ' device(s) connect';
    } else {
        message += 'will stop scanning after ' + argv.discoveryTimeout + ' seconds';
    }
    log(message);
} else {
    argv.expectedDevices = idsToConnectTo.length;
}

let devices = {};

noble.on('stateChange', (state) => {
    if(state === 'poweredOn') {
        noble.startScanning();

        if (!manualIdsWereSpecified && !argv.expectedDevices) {
            //discover until timeout
            setTimeout(() => {
                log('stopping scan after timeout');
                noble.stopScanning();
                if (Object.entries(devices).filter(([, device]) => device.connectionState === 'connected').length === 0) {
                    log('No devices found, exiting');
                    process.exit(-2);
                }
            }, 1000 * argv.discoveryTimeout);
        }

    }
});

if (argv.expectedDevices) {
    log('scanning for %d device(s) %o', argv.expectedDevices, manualIdsWereSpecified ? idsToConnectTo : []);
} else {
    log('scanning for as many devices until timeout');
}

let baseTopic = argv.mqttBaseTopic;
if (!baseTopic.endsWith('/')) {
    baseTopic = baseTopic + '/';
}


let mqttUrl = argv.mqttUrl;
let mqttBinding = require('./src/MQTTConnector');
let mqttUsername = argv.mqttUsername;
let mqttPassword = argv.p;


let expressPort = argv.expressPort;
if (expressPort) {
    let WebBinding = require('./src/WebConnector');
    new WebBinding(devices, expressPort, debugLog);
}

let loggedStop = false;

noble.on('discover', peripheral => {
    if (peripheral.advertisement !== undefined && peripheral.advertisement.localName !== undefined &&
            peripheral.advertisement.localName.startsWith('RISE')) {

        let id = peripheral.advertisement.localName;

        if (idsToConnectTo.length !== 0 && idsToConnectTo.indexOf(id) === -1) {
            debugLog('Found %s but will not connect as it was not specified in the list of devices %o', id, idsToConnectTo);
            return;
        }

        devices[id] = new SomaShade(id, peripheral, noble);
        if (argv.debug) {devices[id].log.enabled = true;}

        peripheral.on('connect', () => {
            log('connected to %s', id);
            if (argv.expectedDevices &&
                Object.entries(devices).filter(([, device]) => device.connectionState === 'connected').length === argv.expectedDevices) {
                if (!loggedStop) {
                    log('all expected devices connected, stopping scan');
                    loggedStop = true;
                }
                noble.stopScanning();
            }
        });

        if (mqttUrl) {
            new mqttBinding(devices[id], mqttUrl, baseTopic, mqttUsername, mqttPassword);
        }
    }
});
