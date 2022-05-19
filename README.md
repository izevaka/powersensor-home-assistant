# Powersensor Home Assistant integration prototype
This is a first attempt at [Powersensor](https://www.powersensor.com.au) integration with Home Assistant. Pretty rough, PRs welcome :-)

## Requirements
* Node-RED
* MQTT broker (e.g. Mosquitto)

Optional:
* Grafana
* InfluxDB
* SSD set-up for Raspberry Pi

Note that if you are running a Raspberry PI with and SD card, this integration will probably accelerate the demise of your SD card. Generally, it's recommended to run HA on an SSD anyway; with multiple sensors updating every second, you will be overloading the SD card.

## How it works
There are two components to Powersensor:
* EM sensor that sits at the switchboard (sensor)
* Power plug that is plugged into an outlet in the house (plug)

The sensor sends power readings to the plug every second or so. The plug is connected to WIFI and it sends both the readings from the sensor and the plug to the Powersensor cloud.

This integration relies an undocumented real-time API that the Powersensor app user for real-time power figures when it's open. The API is a simple pub-sub protocol over UDP.

Node-RED flow connects to each plug in your network and collects readings from them. If you have multiple plugs, one of them is paired with the sensor and that plug will report both the sensor readings and the plug readings.

Node-RED flow will publish messages with voltage and power readings using the following topics:

* `home/energy/sensor/MAC_ADDR/power`
* `home/energy/sensor/MAC_ADDR/voltage`
* `home/energy/sensor/MAC_ADDR/batteryVoltage`

Minimal set-up with one sensor and one plug will produce three readings:
* Plug power
* Plug voltage
* Sensor power
* Sensor battery voltage

The sensor does not have voltage as it's not hard-wired into the circuit.

## Set-up
First of all, you need to figure out the IP and MAC addresses for your sensors. You can get these from the Powersensor app.

![sensor details](/img/sensor-details.PNG)

Import the Node-RED flow and configure the IP address in the "Connect to power plug #..." nodes. The sample has two power plugs. If you only have one, delete the unneeded nodes or add more as needed.

Note that the UDP connections and listeners are separate nodes, which is a bit strange, but it's a limitation of Node-RED. When removing extra nodes, make sure that you match the outgoing (listen) port between the sending and receiving nodes. Because of this, you may see some weirdness as you are debugging the flow. Specifically, this manifestsas "Not connected" error message. This happens because we are trying to open a socket to a port that's already in use. If that happens, disable the flow, deploy, then enable again and re-deploy.

Next step is to create sensors that turn the MQTT messages into sensor readings. These sensors can then be displayed in dashboards. See below Sensor configuration template for an example. You will need the sensors' MAC addresses for this step. Note that the plugs have both a MAC address and an IP address, whereas the power board sensor has only a mac address.

Once the sensors are configured, you should be able to see the sensor reading in Developer Tools.

![Developer tools](/img/developer-tools.PNG)

## Basic sensor configuration template
This configuration block creates power and voltage sensors from MQTT. The second section under `homeassistant/customize` allows customisation of friendly names, in case you want to use those directly in lovelace dashboards.

```
sensor:
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
  - platform: mqtt
    state_topic: home/energy/sensor/MAC_ADDR/batteryVoltage
    name: main_powersensor_battery_voltage
    device_class: voltage
    unit_of_measurement: V
homeassistant:
  customize:
    sensor.plug_name_power:
      state_class: measurement
      friendly_name: Friendly Plug Name
    sensor.main_powersensor_sensor:
      state_class: measurement
      friendly_name: Total Household Power
```

## Energy sensors (suitable for Energy dashboard)
Powersensor plugs emit power readings only. To convert those into energy, you basically need to multiply power by time, also known as integrating with respect to time. Luckily HA provides  built-in tooling to do exactly that using **integration** sensor. Inspiration - [Mark Wunderling's blog post](https://mwunderling.com/blog/energymonitoringha.html).

This section shows how to create energy sensors that are suitable for using in HA Energy dashboard. I found that the energy dashboard needs `state_class` to be set to `total_increasing`, even though the documentation [suggests](https://developers.home-assistant.io/docs/core/entity/sensor/#long-term-statistics) that `total` should work, so this particular customisation is mandatory.

```
sensor:
  - platform: integration
    source: sensor.main_powersensor_sensor
    unit_prefix: k
    round: 2
    name: main_powersensor_sensor_energy
homeassistant:
  customize:
    sensor.main_powersensor_sensor_energy:
      state_class: total_increasing
      friendly_name: Total Household Energy
```

## Util
The optional `capture-sensor` utility allows direct connection to the sensor for debugging and troubleshoting purposes. This is a node.js program with a straight forward interface.

```
ᐅ node capture-sensor.mjs
Host argument required
Usage: node capture.sensor.mjs [--raw] host [port|49476]
```

By default, the utility outputs MQTT messages that the Node-RED flow outputs. Specifying `--raw` will switch to outputing raw JSON as it comes out from the plug. In raw mode, the protocol messages are supressed.

 ## Limitations
 The Node-RED flow is pretty fragile, I don't really trust it, but it seems to perform OK so far, including surviving HA restarts.

 If you reposition the sensor and press the sensor button to show the signal strength, the sensor power reading switches into a different mode, where the reported unit is `U`. What it is is a mystery to me. I suspect it's the raw EM reading from the sensor. I  fudged the multipler (approximately 20) to convert it back to watts by inspecting the output. This may be completely different in your set up. The sensor will stay in this mode for about 2 hours.