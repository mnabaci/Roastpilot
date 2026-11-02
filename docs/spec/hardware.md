# Hardware and serial protocol

The app talks only to the Arduino over USB serial. The Arduino runs the SkyCommand sketch from
[SkywalkerRoaster](https://github.com/jmoore52/SkywalkerRoaster) (`SkyCommand/SkyCommand.ino`,
GPL-3.0), which handles the roaster's pulse-timing protocol. No firmware changes are needed for v1.

- **Board:** Arduino Leonardo on the roaster's controller line. On macOS it shows up as `/dev/cu.usbmodem*`, on Windows as `COMx`; the app lists ports and you pick one.
- **Serial:** 115200 baud, text commands, one per line.

## Commands

| Command    | Sets                                                | Values                      |
| ---------- | --------------------------------------------------- | --------------------------- |
| `READ`     | Replies with a status line (below)                  | –                           |
| `OT1;n`    | Heater                                              | 0–100                       |
| `OT2;n`    | Fan (vent)                                          | 0–100                       |
| `COOL;n`   | Bean cooling fan                                    | 0–100                       |
| `FILTER;n` | Filter fan                                          | 0–100                       |
| `DRUM;n`   | Drum                                                | 0 = off, anything else = on |
| `OFF`      | Everything off                                      | –                           |
| `ESTOP`    | Heater 0, fan 100 (drum, cooling, filter unchanged) | –                           |
| `UNITS;C`  | Report temperature in °C (default is °F)            | –                           |

## READ reply

Comma-separated: `0.00,<temp>,<temp>,<heater>,<fan>,0`, for example `0.00,180.25,180.25,40,60,0`.

- Field 2 (and its copy, field 3) is the roaster temperature, in °F unless `UNITS;C` was sent.
- Fields 4 and 5 echo the heater and fan values the sketch is sending.
- The temperature comes from a fitted polynomial over two raw sensor values. It is not a true bean probe, so profile temperatures are in "Skywalker degrees", tuned by taste.

## Sketch behaviour the driver must respect

- **One command at a time.** The sketch reads whatever arrived within 100 ms as one message, so two commands sent back to back can merge and one is lost. The driver queues commands and sends the next only after a short gap (≥ 150 ms) or after the previous reply.
- **Clean integers only.** Values above 100 are silently ignored and decimals are truncated. The driver clamps and rounds to the roaster's step (5%) before sending.
- **Celsius on connect.** The driver sends `UNITS;C` right after opening the port, then verifies with a `READ`.
- **Watchdog:** after 10 s without a heater, fan, drum, cooling or filter command (`READ` included), the sketch switches everything off. The app polls `READ` every 1 s, which keeps it alive. The roaster itself stops after about 1 s without a control message from the Arduino.
- **Stale readings:** if the Arduino fails to read the roaster, `READ` keeps returning the last good temperature with no error. The stalled-temperature alarm ([safety.md](safety.md)) is the app's only signal for this.
- **Sketch over-temperature:** the sketch runs `ESTOP` above 300 °C. The app's own limit (240 °C per roaster) trips long before.
- **Safe stop from the app:** `OT1;0`, then `OT2;100`, then `COOL;100`, spaced like any other commands; `ESTOP` as a fallback.

## Firmware in this repo

`firmware/skywalker-tc4/` may hold a copy of the sketch with its GPL-3.0 license and credit kept beside it. The app is a separate program that talks to it over serial, so the app's own license is unaffected.
