const EventEmitter = require('events');

const positionCharUUID = '00001525b87f490c92cb11ba5ea5167c';
const movePercentUUID = '00001526b87f490c92cb11ba5ea5167c';
const motorCharUUID = '00001530b87f490c92cb11ba5ea5167c';
const groupUUID = '00001893b87f490c92cb11ba5ea5167c';
const nameUUID = '00001892b87f490c92cb11ba5ea5167c';
const battPercentUUID = '2a19';
const notifyUUID = '00001531b87f490c92cb11ba5ea5167c';

const calibrateCharUUID = '00001529b87f490c92cb11ba5ea5167c';

class SomaShade extends EventEmitter {
    constructor(id, peripheral, noble) {
        super();
        this.log = require('debug')(`soma:${id}`);
        this.id = id;
        this.peripheral = peripheral;
        this.noble = noble;

        this.identifyCharacteristic = null;
        this.movePercentCharacteristic = null;
        this.motorCharacteristic = null;
        this.positionCharacteristic = null;

        this.disconnectHandler = null;
        this.shouldIdentifyOnReconnect = false;
        this.desiredPositionOnReconnect = null;

        this.name = null;
        this.group = null;
        this.positionLastChanged = null;
        this.batteryLevelLastChanged = null;
        this.state = 'unknown';

        this.connectTime = null;

        Object.defineProperty(this, '_name', {set: function(name) {
            if (this.name === name) { return; }
            this.name = name;
            this.log('name: %s', this.name);
            this.emit('nameChanged', this.getState());
        }});

        Object.defineProperty(this, '_group', {set: function(group) {
            if (this.group === group) { return; }
            this.group = group;
            this.log('group: %s', this.group);
            this.emit('groupChanged', this.getState());
        }});

        Object.defineProperty(this, '_position', {set: function(position) {
            this.position = position;
            this.positionLastChanged = new Date();
            this.state = this.position === -1 ? 'unknown' : this.position ===  0 ? 'closed' : 'open';
            this.emit('positionChanged', this.getState());
        }});

        Object.defineProperty(this, '_battery', { set: function(level) {
            this.battery = level;
            this.batteryLevelLastChanged = new Date();
            this.emit('batteryLevelChanged', this.getState());
        }});

        Object.defineProperty(this, '_connectionState', {set: function(state) {
            this.connectionState = state;
            this.emit('connectionStateChanged', this.getState());
        }});
        this._connectionState = 'disconnected';
    }

    move(position) {
        var closePercent = position;
        closePercent = 100 - closePercent;
        closePercent = closePercent.toString();
        if (this.movePercentCharacteristic == null) {
            this.desiredPositionOnReconnect = position;
            return;
        }
        this.movePercentCharacteristic.write(Buffer.from([closePercent.toString(16)]), false, function(error) {
            if (error) {
                this.log('ERROR writing to position - %o', error);
            }
        });
    }

    moveUp() {
        this.motorCharacteristic.write(Buffer.from([0x69]), false, (error) => {
            if (error) {
                this.log(error);
            }
        });
    }

    moveDown() {
        this.motorCharacteristic.write(Buffer.from([0x96]), true, (error) => {
            if (error) {
                this.log(error);
            }
        });
    }

    stop() {
        this.motorCharacteristic.write(Buffer.from([0]), false, (error) => {
            if (error) {
                this.log('ERROR writing stop - %o', error);
            }
            this.positionCharacteristic.read();
        });
    }

    identify() {
        this.log('identify called - beep!');
        if (this.identifyCharacteristic == null) {
            this.shouldIdentifyOnReconnect = true;
            return;
        }
        this.identifyCharacteristic.write(Buffer.from([1]));
    }

    connect() {
        this.peripheral.once('disconnect', () => {
            this.log('disconnected');
            this.identifyCharacteristic = null;
            this.movePercentCharacteristic = null;

            this.disconnectHandler = setTimeout(() => {
                this.log('flagging disconnect after timeout');
                this._connectionState = 'disconnected';
            }, 15*1000);

            this.log('connected for %s seconds', (Math.abs(new Date() - this.connectTime) / 1000));
            this.connect();
        });
        this.peripheral.connect((error) => {
            if (error) {this.log(error);}
            if (this.disconnectHandler) clearTimeout(this.disconnectHandler);
            this.connectTime = new Date();
            this.log('connected!');
            this._connectionState = 'connected';

            let characteristicsUuids = [positionCharUUID, movePercentUUID, motorCharUUID, battPercentUUID, groupUUID, nameUUID, notifyUUID, calibrateCharUUID];
            this.peripheral.discoverSomeServicesAndCharacteristics([], characteristicsUuids, (error, services, characteristics) => {
                this.positionCharacteristic = characteristics.filter(char => char.uuid === positionCharUUID)[0];
                this.positionCharacteristic.subscribe();
                this.positionCharacteristic.on('data', (data) => {
                    let position = 100 - data[0];
                    this._position = position;
                    this.log('position %d', position);
                });
                this.positionCharacteristic.read();

                this.identifyCharacteristic = characteristics.filter(char => char.uuid === notifyUUID)[0];
                if (this.shouldIdentifyOnReconnect) {
                    this.identify();
                    this.shouldIdentifyOnReconnect = false;
                }

                let groupChar = characteristics.filter(char => char.uuid === groupUUID)[0];
                groupChar.read((err, data) => {
                    this._group = data.filter(elem => elem != 0).toString().trim();
                });

                let nameChar = characteristics.filter(char => char.uuid === nameUUID)[0];
                nameChar.read((err, data) => {
                    this._name = data.filter(elem => elem != 0).toString().trim();
                });

                let battPercentChar = characteristics.filter(char => char.uuid === battPercentUUID)[0];
                battPercentChar.subscribe();
                battPercentChar.on('data', (data) => {
                    let reading = data[0];
                    var batt = Math.min(100, reading / 75 * 100).toFixed(0);
                    this.log('battery at %d%%', batt);
                    this._battery = parseInt(batt);
                });
                battPercentChar.read();

                this.movePercentCharacteristic = characteristics.filter(char => char.uuid === movePercentUUID)[0];
                if (this.desiredPositionOnReconnect !== null) {
                    this.move(this.desiredPositionOnReconnect);
                    this.desiredPositionOnReconnect = null;
                }
                this.motorCharacteristic = characteristics.filter(char => char.uuid === motorCharUUID)[0];

                this.calibrateCharacteristic = characteristics.filter(char => char.uuid === calibrateCharUUID)[0];
            });
        });
    }

    calibrateMode(start = true) {
        if (this.calibrateCharacteristic != null) {
            this.calibrateCharacteristic.write(Buffer.from([start ? 0x76 : 0x36]), false);
        }
    }

    calibrate(top = true) {
        if (this.calibrateCharacteristic != null) {
            this.calibrateCharacteristic.write(Buffer.from([top ? 0x69 : 0x96]), false);
        }
    }

    getState() {
        return {
            id: this.id,
            battery: this.battery,
            batteryLevelLastChanged: this.batteryLevelLastChanged,
            position: this.position,
            positionLastChanged: this.positionLastChanged,
            connectionState: this.connectionState,
            state: this.state,
            group: this.group,
            name: this.name
        };
    }
}

module.exports = SomaShade;
