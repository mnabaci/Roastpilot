# Hardware and serial protocol

The app talks only to the Arduino over USB serial, reusing the
[SkywalkerRoaster](https://github.com/jmoore52/SkywalkerRoaster) sketch and its TC4-style text
commands. The Arduino handles the roaster's pulse-timing protocol. No firmware changes are needed
for v1.

- **Board:** Arduino Leonardo on the roaster's controller line. On macOS it shows up as `/dev/cu.usbmodem*`.

| Command               | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `READ`                | Request current temperature; also keeps the sketch alive |
| `OT1;<0-100>`         | Heater or fan duty % (mapping to confirm)                |
| `OT2;<0-100>`         | Fan or heater duty % (mapping to confirm)                |
| `DRUM;100` / `DRUM;0` | Drum motor on / off                                      |
| `FILTER;<0-4>`        | Filter setting                                           |

- **Duty steps:** heater and fan move in 5% steps. The app rounds every output to the nearest 5.
- **Watchdogs:** the sketch shuts down after 10 s without a command; the roaster stops after about 1 s without a control message from the Arduino. The app polls `READ` every 1 s.
- **Temperature:** one value per reading, converted by the sketch from raw sensor numbers. It is not a true bean probe, so profile temperatures are in "Skywalker degrees" and are tuned by taste.
