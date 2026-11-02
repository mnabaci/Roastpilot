# Hardware and serial protocol

The app talks only to the controller board over USB serial. The board runs the SkyCommand sketch from
[SkywalkerRoaster](https://github.com/jmoore52/SkywalkerRoaster) (`SkyCommand/SkyCommand.ino`,
GPL-3.0), which handles the roaster's pulse-timing protocol. Flash the latest upstream sketch; it reports protocol version `1`.

- **Board:** ESP32-WROOM-32 on the roaster's controller line, connected through its USB-to-serial chip. On macOS it shows up as `/dev/cu.usbserial-*`, on Windows as `COMx`; the app lists ports and you pick one.
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
| `VERSION`  | Replies with the protocol version, e.g. `1`         | –                           |

## READ reply

Comma-separated: `0.00,<temp>,<temp>,<heater>,<fan>,0`, for example `0.00,180.25,180.25,40,60,0`.

- Field 2 (and its copy, field 3) is the roaster temperature, in °F unless `UNITS;C` was sent.
- Fields 4 and 5 echo the heater and fan values the sketch is sending.
- The temperature comes from a fitted polynomial over two raw sensor values. It is not a true bean probe, so profile temperatures are in "Skywalker degrees", tuned by taste.

## Sketch behaviour the driver must respect

- **One command at a time.** The sketch reads whatever arrived within 100 ms as one message, so two commands sent back to back can merge and one is lost. The driver queues commands and sends the next only after a short gap (≥ 150 ms) or after the previous reply.
- **Clean integers only.** Values above 100 are silently ignored and decimals are truncated. The driver clamps and rounds to the roaster's step (5%) before sending.
- **Celsius on connect.** The driver sends `UNITS;C` right after opening the port, then verifies with a `READ`.
- **Version check on connect.** The driver sends `VERSION` and refuses to roast if the reply is not the protocol version it speaks, with a banner saying which sketch to flash. No reply to `VERSION` means an older sketch: also a mismatch.
- **Replies:** only `READ` and `VERSION` reply. The driver waits up to 500 ms; no reply is a `no-reply` error, and a line that doesn't parse is a `bad-reply`. Neither throws: the safety monitor's lost-connection rule decides what to do.
- **Port closed:** if the port closes (cable pulled), every call returns `disconnected` until `connect()` succeeds again.
- **Watchdog:** after 10 s without a heater, fan, drum, cooling or filter command (`READ` included), the sketch switches everything off. The app polls `READ` every 1 s, which keeps it alive. The roaster itself stops after about 1 s without a control message from the board.
- **Stale readings:** if the board fails to read the roaster, `READ` keeps returning the last good temperature with no error. The stalled-temperature alarm ([safety.md](safety.md)) is the app's only signal for this.
- **Sketch over-temperature:** the sketch runs `ESTOP` above 300 °C. The app's own limit (240 °C per roaster) trips long before.
- **Safe stop from the app:** `OT1;0`, then `OT2;100`, then `COOL;100`, spaced like any other commands; `ESTOP` as a fallback.

## Simulator

`SimulatedDriver` is a twin of this setup, so whatever runs on it runs on the real roaster.

- **Same channels:** `bt` (°C, read), `heater`, `fan`, `cooling`, `filter` (0–100, step 5) and `drum` (on/off), with the same safe-stop sequence.
- **Same sketch behaviour:** 10 s watchdog switches everything off; `ESTOP` above 300 °C; reports protocol version `1`.
- **Thermal model:** one temperature, updated in 100 ms steps from the injected clock. Heater adds heat; loss to the room grows with the gap to ambient, the fan and the cooling fan.

| Constant         | Default   | Effect                                       |
| ---------------- | --------- | -------------------------------------------- |
| Ambient          | 22 °C     | Start temperature and where it cools back to |
| Heat gain        | 1.5 °C/s  | Rise per second at heater 100, before losses |
| Room loss        | 0.0054 /s | Heater 100, fan 0 levels off near 300 °C     |
| Fan loss factor  | 1.0       | Fan 100 doubles the loss                     |
| Cool loss factor | 3.0       | Cooling 100 adds three times the loss        |

Hand-picked for now; refit from the first real manual roast.

- **Faults for tests:** stall the reported temperature (like the sketch's stale readings), disconnect and reconnect, report another protocol version.
- **Deterministic:** no noise, no randomness; same inputs and clock give the same readings.

## Firmware in this repo

`firmware/skywalker-tc4/` may hold a copy of the sketch with its GPL-3.0 license and credit kept beside it. The app is a separate program that talks to it over serial, so the app's own license is unaffected.
