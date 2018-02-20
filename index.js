let noble = require('noble');

let positionCharUUID = "00001525b87f490c92cb11ba5ea5167c";
let movePercentUUID = "00001526b87f490c92cb11ba5ea5167c";
let battPercentUUID = "2a19";

if (!process.argv[2]) {
	console.error("No device name supplied (required as first parameter) - format RISEnnn");
	process.exit(-1);
}

noble.startScanning();

let timeout = process.env.TIMEOUT_SECS || 15;

setTimeout(() => {
	noble.stopScanning();
	console.error('timeout of ' + timeout + ' seconds reached (adjustable by TIMEOUT_SECS envvar)');
	process.exit(1);
}, timeout * 1000);

noble.on('discover', function(peripheral) {
	//to find a new soma's address, connect to any with advertisement.localName.startsWith("RISE") and the next time discover will include the address (macOS limitation)
	if (peripheral.advertisement !== undefined && peripheral.advertisement.localName !== undefined &&
		peripheral.advertisement.localName === process.argv[2]) {
		char(peripheral, noble);
	}
});

function char(peripheral, noble) {
	peripheral.connect(function(error) {
		peripheral.discoverSomeServicesAndCharacteristics([], [positionCharUUID, movePercentUUID, battPercentUUID], function(error, services, characteristics) {
			if (!process.argv[3]) {
                let positionChar = characteristics.filter(char => char.uuid === positionCharUUID)[0];
                positionChar.read((err, readData) => {
                	let position = readData[0];
                	console.log(100 - position);
                	peripheral.disconnect();
                	process.exit();
                });
                return;
			}

			if (process.argv[3] === 'batt') {
				let battPercentChar = characteristics.filter(char => char.uuid === battPercentUUID)[0];
				battPercentChar.read((err, readData) => {
					let batt = readData[0];
					console.log(batt);
					peripheral.disconnect();
					process.exit();
				});
				return;
			}


			let movePercentChar = characteristics.filter(char => char.uuid === movePercentUUID)[0];
			var closePercent = process.argv[3] || 30;
			closePercent = 100 - closePercent;
			closePercent = closePercent.toString();
			movePercentChar.write(Buffer.from([closePercent.toString(16)]), false, function(error) {
				if (error) {console.log(error); }
				peripheral.disconnect();
				noble.stopScanning();
				process.exit();
			});
        });
    });
	noble.stopScanning();
}
