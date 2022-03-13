# Powersensor Home Assistant integration prototype
This is a first attempt at [Powersensor](https://www.powersensor.com.au) integration with Home Assistant. Pretty rough, PRs welcome :-)

## Requirements
* Node-RED
* MQTT broker (e.g. Mosquitto)

Optional:
* Grafana
* InfluxDB
* Non-SD set-up for Raspberry Pi

Note that if you are running a Raspberry PI with and SD card, this integration will probably accelerate the demise of your SD card. Generally, it's recommended to run HA on an SSD anyway; with multiple sensors updating every second, you will be overloading the SD card.

## How it works
There are two components to Powersensor:
* EM sensor that sits at the switchboard
* Power plug that is plugged into an outlet in the house

The sensor communicates to the plug via BLE and sends the power readings every second or so. The plug is connected to WIFI and sends the reading both from the sensor and the plugs to the Powersensor cloud.

This integration uses an undocumented real-time API that the app uses for real-time power figures when the app is open. It's a simple pub-sub protocol over UDP.

Node-RED flow connects to each plug in your network and collects readings from them. If you have multiple plugs, one of them is paired with the sensor and that plug will report both the sensor readings and the plug readings.

Node-RED flow will publish messages with voltage and power readings using the following topics:

* `home/energy/sensor/MAC_ADDR/power`
* `home/energy/sensor/MAC_ADDR/voltage`

Minimal set-up with one sensor and one plug will produce three readings:
* Plug power
* Plug voltage
* Sensor power
The sensor does not have voltage as it's not hard-wired into the circuit.

## Set-up
First of all, you need to figure out the IP and MAC addresses for your sensors. You can get these from the Powersensor app.

![sensor details](/img/sensor-details.PNG)

Import the Node-RED flow and configure the IP address in the "Connect to power plug #..." nodes. The sample has two power plugs, but you may only have one. Delete the unneeded nodes or add more as needed.

Next step is to create sensors that turn the MQTT messages into sensor readings. These sensors can then be displayed in dashboards. See below Sensor configuration template for an example. You will need the sensors' MAC addresses for this step. Note that the plugs have both a MAC address and an IP address, whereas the power board sensor has only a mac address.

Once the sensors are configured, you should be able to see the sensor reading in Developer Tools.

![Developer tools](/img/developer-tools.PNG)

## Sensor configuration template

```
  - platform: mqtt
    state_topic: home/energy/sensor/MAC_ADDR/power
    name: plug_name_power
    device_class: power
    unit_of_measurement: W
  - platform: mqtt
    state_topic: home/energy/sensor/MAC_ADDR/power
    name: main_powersensor_sensor
    device_class: power
    unit_of_measurement: W
  - platform: mqtt
    state_topic: home/energy/sensor/MAC_ADDR/voltage
    name: plug_name_voltage
    device_class: voltage
    unit_of_measurement: V
```