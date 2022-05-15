import dgram from 'dgram';
import { join } from 'path/posix';
import { stdout, argv, exit } from 'process';

function main() {
    const socket = dgram.createSocket('udp4');
    let args = argv.slice(2);
    let arg = null;
    let rawMode = false;
    let host = null;
    let port = 49476;

    while (arg = args.shift()) {
        if (arg === '--raw') {
            rawMode = true;
        } else if (!host) {
            host = arg;
        } else {
            port = arg;
        }
    }
    if (!host) {
        console.error("Host argument required");
        console.error("Usage: node capture.sensor.mjs [--raw] host [port|49476]");
        exit(1);
    }

    socket.on('error', (err) => {
        console.error(`Error:\n${err.stack}`);
        closeAndExit(socket);
    });

    socket.on('message', (rawJson, rinfo) => {
        let output = null;

        if (rawMode) {
            output = outputJson(rawJson)
        }
        else {
            output = JSON.stringify(nodeRedFunc({
                payload: JSON.parse(rawJson)
            }))+ "\n";
        }
        if (output)
            stdout.write(output);
    });

    socket.connect(port, host, (p1, p2) => {
        subscribe(socket);
        setInterval(() => {
            console.error('Scheduled resubscribe');
            subscribe(socket);
        }, 100000);
    });
}

function subscribe(s) {
    s.send('subscribe(180)\n');
}
function closeAndExit(s) {
    s.close();
    exit(1);
}


/**
 * Returns zero or two MQTT messages. When there is a sensor reading, this produces two messages - one for voltage, one for power.
 * @param {Object} msg - Simulated Node-RED message
 * @param {Object} msg.payload - Object containing parsed sensor output
 * @returns An array of arrays of messages as per the Node-RED function node specification. See "Multiple Messages" under https://nodered.org/docs/user-guide/writing-functions
 */
function nodeRedFunc(msg) {
    const sensorReading = msg.payload;
    //raw message that comes from the sensor UDP
    const [type, subtype] = [sensorReading['type'], sensorReading['subtype']];

    if (type === 'subscription') {
        if (subtype === 'expiry') {
            console.error('The socket stream has expired, exiting');
        }
        else if (subtype === 'warning') {
            console.error('The socket stream had a subscription warning, resubscribing');
        }
    } else if (type === 'instant_power') {
        const unit = sensorReading.unit.toLowerCase();
        let output = [];

        //handle power first
        let power = sensorReading.power;
        if (unit === 'u') {
            power = power / 19.3;
        }

        output.push(
            {
                topic: `home/energy/sensor/${sensorReading.mac}/power`,
                payload: Math.round(power)
            });

        //handle voltage message
        if (sensorReading.voltage) {
            output.push(
                {
                    topic: `home/energy/sensor/${sensorReading.mac}/voltage`,
                    payload: sensorReading.voltage.toFixed(2)
                });
        }
        return [output];
    }
    return null;
}

/**
 * Filter out non-power readings and return the original message. Used for testing.
 * @param {string} Raw string representing one UDP message from a powersensor plug 
 * @returns Raw JSON if the message is a power reading.
 */
function outputJson(rawJson) {
    const msg = JSON.parse(rawJson);
    const [type, subtype] = [msg['type'], msg['subtype']];

    if (type === 'subscription') {
        if (subtype === 'expiry') {
            console.error('The socket stream has expired, exiting');
            closeAndExit(socket);
        }
        else if (subtype === 'warning') {
            //resubscribe to the stream
            console.error('The socket stream had a subscription warning, resubscribing');
            subscribe(socket);
        }
    } else if (type === 'instant_power') {
        return rawJson;
    }
    return null;
}

main();

