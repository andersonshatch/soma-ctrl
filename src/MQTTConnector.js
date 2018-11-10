const mqtt = require('mqtt');

const coverTopic = 'cover/';

class MQTTConnector {
    constructor(device, mqttUrl, baseTopic, username, password) {
        const mqttClient = mqtt.connect(mqttUrl, {
            will: {
                topic: `${baseTopic}${coverTopic}${device.id}/connection`,
                payload: 'disconnected',
                retain: true
            },
            username: username,
            password: password
        });

        let deviceTopic = `${baseTopic}${coverTopic}${device.id}`;
        mqttClient.subscribe([`${deviceTopic}/move`, `${deviceTopic}/identify`]);

        mqttClient.on('message', (topic, message) => {
            if (topic.endsWith('move') && message.length !== 0) {
                if (message.toString().toLowerCase() === 'stop') {
                    device.log('requesting stop');
                    device.stop();
                } else {
                    device.log(`requesting move to ${message}`);
                    device.move(message);
                }
            } else if (topic.endsWith('identify')) {
                device.log('requesting identify');
                device.identify();
            }
        });

        let deviceInfo = {
            identifiers: `soma_${device.id}`,
            name: device.id,
            manufacturer: 'Soma',
            model: 'Smart Shade'
        };

        let coverConfig = {
            name: device.id,
            state_topic: `${deviceTopic}/position`,
            availability_topic: `${deviceTopic}/connection`,
            payload_available: 'connected',
            payload_not_available: 'disconnected',
            position_topic: `${deviceTopic}/position`,
            set_position_topic: `${deviceTopic}/move`,
            command_topic: `${deviceTopic}/move`,
            payload_open: '100',
            payload_close: '0',
            unique_id: `soma_${device.id}_cover`,
            device: deviceInfo
        };

        let battSensorConfig = {
            name: `Cover ${device.id} battery`,
            state_topic: `${deviceTopic}/battery`,
            unit_of_measurement: '%',
            device_class: 'battery',
            unique_id: `soma_${device.id}_battery`,
            device: deviceInfo
        };

        device.log(`mqtt topic ${deviceTopic}`);

        device.on('nameChanged', (data) => {
            coverConfig.name = data.name;
            coverConfig.device.name = data.name;
            mqttClient.publish(`${deviceTopic}/config`, JSON.stringify(coverConfig), {retain: true});
            battSensorConfig.name = `Cover ${data.name} battery`;
            battSensorConfig.device.name = data.name;
            mqttClient.publish(`${baseTopic}sensor/cover_${data.name.replace(' ', '_')}_battery/config`, JSON.stringify(battSensorConfig), {retain: true});
        });

        device.on('batteryLevelChanged', (data) => {
            mqttClient.publish(`${deviceTopic}/battery`, `${data.battery}`, {retain: true});
        });

        device.on('positionChanged', (data) => {
            mqttClient.publish(`${deviceTopic}/position`, `${data.position}`, {retain: true});
        });

        device.on('connectionStateChanged', data => {
            mqttClient.publish(`${deviceTopic}/connection`, data.connectionState, {retain: true});
        });

        mqttClient.on('connect', () => device.log('mqtt connected'));
        mqttClient.on('end', () => device.log('mqtt ended'));
        mqttClient.on('error', (e) => device.log('mqtt error %o', e));
    }
}

module.exports = MQTTConnector;
