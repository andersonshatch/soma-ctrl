const express = require('express');

class WebConnector {
    constructor(devices, port, log) {
        this.devices = devices;
        this.express = express();
        this.setupExpressRoutes();
        this.log = log;
        this.log('listening on port %d', port);
        this.express.listen(port);
    }

    setupExpressRoutes() {
	this.express.post('/exit', (req, res) => {
		res.sendStatus(200);
		process.exit(1);
	});
        this.express.get('/', (req, res) => {
            var output = {};
            Object.entries(this.devices).forEach(([id, device]) => output[id] = device.getState());
            res.json(output);
        });

        this.express.get('/:blindId', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {return;}

            res.json(device.getState());
        });

        this.express.post('/:blindId/calibrateModeStart', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {
                return;
            }

            device.log('requesting start calibrate');
            device.calibrateMode(true);
            res.sendStatus(200);
        });

        this.express.post('/:blindId/calibrateBottom', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {
                return;
            }

            device.log('requesting calibrate bottom');
            device.calibrate(false);
            res.sendStatus(200);
        });

        this.express.post('/:blindId/stop', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {
                return;
            }

            device.log('requesting stop');
            device.stop();
            res.sendStatus(200);
        });

        this.express.post('/:blindId/moveUp', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {
                return;
            }

            device.log('requesting move up');
            device.moveUp();
            res.sendStatus(200);
        });

        this.express.post('/:blindId/moveDown', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {
                return;
            }

            device.log('requesting move down');
            device.moveDown();
            res.sendStatus(200);
        });

        this.express.post('/:blindId/calibrateTop', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {
                return;
            }

            device.log('requesting calibrate top');
            device.calibrate(true);
            res.sendStatus(200);
        });

        this.express.post('/:blindId/calibrateModeStop', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {
                return;
            }

            device.log('requesting stop calibrate');
            device.calibrateMode(false);
            res.sendStatus(200);
        });

        this.express.post('/:blindId/identify', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {
                return;
            }

            device.log('requesting identify');
            device.identify();
            res.sendStatus(200);
        });


        this.express.post('/:blindId/move', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {
                return;
            }
            var position = req.query.position;
            if (!position) {
                res.status(400).send('position parameter required');
                return;
            }
            position = parseInt(position);
            if (isNaN(position)) {
                res.status(400).send('position parameter must be an integer');
                return;
            } else if (position < 0 || position > 100) {
                res.status(400).send('position parameter must be between 0 and 100');
                return;
            }

            position = 100 - position;
            device.log('requesting move to %d', position);
            device.move(position);
            res.json(device.getState());
        });

        this.express.post('/:blindId/stop', (req, res) => {
            let device = this.requireDevice(req, res);
            if (!device) {return;}
            device.log('requesting stop');
            device.stop();
            res.sendStatus(200);
        });
    }

    requireDevice(req, res) {
        var device = this.devices[req.params.blindId];
        if (!device) {
            res.sendStatus(404);
            return;
        }

        return device;
    }
}

module.exports = WebConnector;
