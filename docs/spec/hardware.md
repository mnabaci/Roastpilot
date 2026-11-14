# Hardware and serial protocol

The app talks only to a controller board over USB serial, in the text protocol Artisan uses for a
TC4 board. One driver, `Tc4Driver`, speaks it; each kind of board is a **dialect** of it, plain data
([ADR 0026](../adr/0026-one-tc4-driver-with-dialects.md)):

| Dialect    | Board and firmware                                                                      | Roaster model |
| ---------- | --------------------------------------------------------------------------------------- | ------------- |
| SkyCommand | The Skywalker mod's sketch (this page, from Commands to Firmware)                       | Skywalker     |
| Stock TC4  | Arduino + TC4 shield running aArtisanQ_PID ([below](#stock-tc4-firmware-aartisanq_pid)) | Generic TC4   |

A dialect says which command drives each output, what a `READ` reply holds, what the handshake
sends and checks, and the safe-stop sequence. Everything else (the command queue, polling, rounding
to steps, the board-echo check, errors) is the driver's, the same for every dialect.

The SkyCommand dialect: the board runs the SkyCommand sketch,
adapted from [SkywalkerRoaster](https://github.com/jmoore52/SkywalkerRoaster) (GPL-3.0), which
handles the roaster's pulse-timing protocol. Flash the copy in
[`firmware/skywalker-tc4/`](../../firmware/skywalker-tc4/README.md); it reports protocol version `1`.
It also still works with Artisan.

- **Board:** ESP32-WROOM-32 on the roaster's controller line, connected through its USB-to-serial chip. On macOS it shows up as `/dev/cu.usbserial-*`, on Windows as `COMx`; the app lists ports and you pick one.
- **Serial:** 115200 baud, text commands, one per line.

## Commands

| Command    | Sets                                                | Values                      |
| ---------- | --------------------------------------------------- | --------------------------- |
| `READ`     | Replies with a status line (below)                  | –                           |
| `OT1;n`    | Heater                                              | 0–100                       |
| `OT2;n`    | Fan (vent)                                          | 0–100, steps of 5           |
| `COOL;n`   | Bean cooler (tray fan under the drum)               | 0 or 100                    |
| `FILTER;n` | Filter fan                                          | levels 0–4 (on is 1)        |
| `DRUM;n`   | Drum                                                | 0 = off, anything else = on |
| `OFF`      | Everything off                                      | –                           |
| `ESTOP`    | Heater 0, fan 100 (drum, cooling, filter unchanged) | –                           |
| `UNITS;C`  | Report temperature in °C (default is °F)            | –                           |
| `VERSION`  | Replies with the protocol version, e.g. `1`         | –                           |

## READ reply

Comma-separated: `0.00,<temp>,<temp>,<heater>,<fan>,0`, for example `0.00,180.25,180.25,40,60,0`.

- Field 2 (and its copy, field 3) is the roaster temperature, in °F unless `UNITS;C` was sent.
- Fields 4 and 5 echo the heater and fan values the sketch is sending.
- When that echo differs from what the driver last sent (the sketch's own failsafe, or a garbled reply), the driver logs `driver.output-changed-by-board` with the raw line, once until it matches again. The reading shows what the sketch reports.
- The sketch doesn't report cooling, filter or drum, so the driver's reading fills them in from the last value it sent. Every reading holds every channel (bt, heater, fan, cooling, filter, drum), which is what the UI shows and what a roast sample stores.
- The temperature comes from a fitted polynomial over two raw sensor values. It is not a true bean probe, so profile temperatures are in "Skywalker degrees", tuned by taste.

## Sketch behaviour the driver must respect

- **One command per line.** The sketch reads serial without blocking, several times per loop, and runs every line ending in `\n` or `\r` as its own command, so commands sent back to back are all kept. A line with no line ending runs after 100 ms of silence (for senders that don't add one). The driver still sends one at a time, 20 ms apart, so each reply matches its command.
- **Why this changed:** upstream reads with `Serial.readString()` once per roaster cycle (~330 ms, up to ~750 ms when the roaster is silent) and treats everything buffered as one message. Commands closer than a cycle merged and were lost, so `UNITS;C` then `VERSION` 150 ms apart failed to connect.
- **Clean integers only.** Values above 100 are silently ignored and decimals are truncated. The driver clamps and rounds to the roaster's step (5%) before sending.
- **Celsius on connect.** The driver sends `UNITS;C` right after opening the port, then verifies with a `READ`.
- **Version check on connect.** The driver sends `VERSION` and refuses to roast if the reply is not the protocol version it speaks, with a banner saying which sketch to flash. No reply to `VERSION` means an older sketch: also a mismatch.
- **Replies:** only `READ` and `VERSION` reply. The driver waits up to 1.5 s (measured: under 150 ms with the roaster on); no reply is a `no-reply` error, and a line that doesn't parse is a `bad-reply`. Each request only takes a line of its reply's shape (`READ`: has commas; `VERSION`: none), so another command's late reply is dropped (debug log) instead of answering it; a late reply to the same command is only kept out by the 20 ms gap after a timeout, when nothing listens. Neither throws: the safety monitor's lost-connection rule decides what to do.
- **Port closed:** if the port closes (cable pulled), every call returns `disconnected` until `connect()` succeeds again.
- **Watchdog:** after 10 s without a heater, fan, drum, cooling or filter command (`READ` included), the sketch switches everything off. The app polls `READ` every 1 s, which keeps it alive. The roaster itself stops after about 1 s without a control message from the board.
- **Stale readings:** if the board fails to read the roaster, `READ` keeps returning the last good temperature with no error. The stalled-temperature alarm ([safety.md](safety.md)) is the app's only signal for this.
- **Sketch over-temperature:** the sketch runs `ESTOP` above 300 °C. The app's own limit (240 °C per roaster) trips long before.
- **Safe stop from the app:** `OT1;0`, then `OT2;100`, then `COOL;100`, queued like any other commands; `ESTOP` as a fallback.

## Stock TC4 firmware (aArtisanQ_PID)

The generic TC4 model: an Arduino with a TC4 shield running the stock
[aArtisanQ_PID](https://github.com/greencardigan/TC4-shield/tree/master/applications/Artisan/aArtisan_PID/trunk/src/aArtisanQ_PID)
firmware, the board many home-built roasters use with Artisan (poppers, heat guns, Behmor and
Gene Café mods). Checked against the firmware source and Artisan's own TC4 code
(`comm.py`, `ARDUINOTC4temperature`), not its out-of-date `commands.txt`.

- **Wiring is on the record**, because every build differs ([roasters.md](roasters.md#generic-tc4)): BT input, ET input, heater output, fan output, baud. Defaults match the firmware's and Artisan's.
- **Delimiters:** the firmware takes `;`, `,`, space or `=`; the driver sends `;` as for SkyCommand.

| Command     | Sets                                                                                                     | Values                                         |
| ----------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `CHAN;ebxx` | Which TC input (1–4) is logical channel 1 (ET) and 2 (BT); `0` = off                                     | `CHAN;1200` by default; `CHAN;0200` with no ET |
| `UNITS;C`   | Report °C                                                                                                | –                                              |
| `READ`      | Replies with a status line (below)                                                                       | –                                              |
| `OT1;n`     | Heater on OT1 (the usual output)                                                                         | 0–100                                          |
| `IO3;n`     | Heater on IO3 (a heater-on-IO3 build), or a DC fan on IO3; not in the PAC3 build                         | 0–100                                          |
| `OT2;n`     | AC fan on OT2 (the firmware's default build)                                                             | 0–100                                          |
| `PID;STOP`  | PID and OT1 off, fan to the build's auto-cool level; leaves IO3 alone, or sets it to 100, in most builds | –                                              |

- **READ reply:** `ambient,ch1,ch2,…,heater,fan,setpoint` in the order of `CHAN`; with `CHAN;eb00` that's `ambient,ET,BT,heater,fan,0`, the same six fields as SkyCommand's. With no ET (`CHAN;0b00`) it's five: `ambient,BT,heater,fan,0`. An empty field is no value. Heater and fan echo the firmware's duty, so the board-echo check works as for SkyCommand. Which outputs it echoes is fixed by how the firmware was built (`HEATER_DUTY`, `FAN_DUTY` in `user.h`), not by the wiring: the default build (CONFIG_PAC2) echoes OT1 and OT2, the PWM build OT1 and IO3, the heater-on-IO3 build IO3 and OT2. Wiring that doesn't match the build shows wrong heater or fan values and makes the board-echo check log; pick the outputs your build drives.
- **Acknowledgements:** `CHAN` always replies `# Active channels set to …`; other commands only on a build with acks on. The driver drops every line that starts with `#` (debug log), so none answers a `READ`.
- **Boot defaults:** the firmware starts with TC2 as channel 1 and TC1 as channel 2, in °F. A `CHAN` the board misses while it boots would leave BT and ET swapped and in °F, so connect never goes on without its acknowledgement.
- **Connect:** open the port at the record's baud (default 115200), wait 1.5 s (the Arduino restarts when the port opens; Artisan waits 1 s), then send `CHAN` until the board acknowledges it (3 tries, 1.5 s each; none is a `no-reply` error). Then `PID;OFF` (its PID drives OT1 on its own), the heater's output to 0, then every other output the firmware has (`OT1`, `OT2`, `IO3`) to 0 whatever the wiring, so nothing runs unseen on a board that didn't restart; then `FILT;10;10;10;10` (the firmware's own filtering: a board that didn't restart would keep whatever Artisan last set, `FILT;70,70,70,70` by default, which lags the readings Auto steers by), then `UNITS;C` and the first `READ`. The driver then takes every output as 0, so the board-echo check doesn't flag the switch-off. A reply that doesn't parse is `bad-reply`. Connect errors name the firmware and the baud ("No reply · check the baud, and that aArtisanQ_PID is flashed"). There is no version check: the stock firmware has none.
- **Live inputs:** on the roaster's page, while connected and no roast or drum cooling runs, the driver switches to `CHAN;1234`, reads `ambient,TC1,TC2,TC3,TC4,heater,fan,setpoint`, then sends the record's `CHAN` again, even when the read failed ([roasters.md](roasters.md#generic-tc4)). Reads run one at a time, so a poll never lands between the two `CHAN`s; a safe stop is never held back by a probe. If putting `CHAN` back fails, polling reads `bad-reply` until the lost-connection rule trips: it fails safe.
- **Outputs:** clean integers 0–100 in steps of 5, as for SkyCommand. Heater and fan never share an output; the record refuses it.
- **No watchdog:** the firmware keeps its last outputs forever. If the app crashes or the cable is pulled, the heater stays on until someone switches it off. Safe stop from the app: heater 0, then fan 100. Fallback: `PID;STOP` for a heater on OT1; for a heater on IO3, `IO3;0` again, as `PID;STOP` leaves IO3 alone or turns it fully on in most builds.
- **Against Artisan** (`comm.py` `ARDUINOTC4temperature`, `devices.py`, `pid_control.py`, the Hottop and Kaleido TC4 machine files): same serial settings (115200 8N1), same `CHAN;<et><bt>00` with ET on 1 and BT on 2 and its `#` acknowledgement checked, same `UNITS;C`, same `READ` fields (ET 1, BT 2, heater 3, fan 4), same output commands (`OT1`, `OT2`, `IO3`; Artisan's Hottop file uses the ramped `DCFAN` for its fan, which this app doesn't), `PID;OFF` as Artisan sends it. Where this app differs, on purpose: it waits 1.5 s after opening instead of 1 s, retries `CHAN` until acknowledged where Artisan tries again on its next reading, switches every output off on connect and sends its own safe stop where Artisan sends nothing unless a button is set up, sends `FILT` with the firmware's level instead of Artisan's 70 %, and with no ET probe reads BT from field 1, as the firmware prints only active channels (Artisan reads field 2 whatever).
- **Firmware's own limits:** `MIN_IO3` can raise a small non-zero IO3 value (the board-echo check logs it); `HTR_CUTOFF_FAN_VAL` (0 by default) is the firmware's own minimum fan, which the app's doesn't rely on.
- **Ambient** (field 1, the board's own sensor) is not a channel: not shown, not saved.

## Simulator

`SimulatedDriver` is a twin of this setup, so whatever runs on it runs on the real roaster.

- **Same channels:** `bt` (°C, read; named "Temperature" / "Temp": the probe is the drum where it touches the beans, not a probe in the bean mass), `heater` and `fan` (0–100, step 5), `cooling` (0 or 100), `filter` (levels 0–4) and `drum`, with the same safe-stop sequence. One difference: the Simulator's drum has a speed (0–100 %, step 5) instead of on/off, so drum speed can be tried without such a roaster. The thermal model ignores it. A second: it also reports `et`, so ET can be seen and tested without a roaster that has an ET probe (below).
- **ET (environment temperature):** the air in the drum. It follows the drum's metal quickly as it heats (15 s) and slowly as it cools (90 s: the beans cool the metal, not the heater), plus a lift from the heater (25 °C at heater 100, half of it blown away at fan 100) that it follows quickly (8 s). So it leads BT when the heater changes, stays above BT through preheat, and dips far less than BT at charge. Not fitted to anything (no roast has an ET yet); its constants (`DEFAULT_ENVIRONMENT_CONSTANTS`) are kept apart from the fitted ones. It changes nothing else: BT is exactly as before, so the roast-16 test is untouched, and a stalled temperature stalls ET too.
- **Same sketch behaviour:** keeps every command, 10 s watchdog switches everything off; `ESTOP` above 300 °C; reports protocol version `1`.
- **Thermal model:** the drum's temperature, updated in 100 ms steps from the injected clock. Heater adds heat; loss to the room grows with the gap to ambient, the fan and the cooling fan.
- **Beans:** `chargeBeans()` puts room-temperature beans in the drum and `dumpBeans()` takes them out. With beans in, the drum heats them and loses that heat, and the probe follows the beans with a lag, so BT dips at charge and turns, like a real roast. Without beans the probe reads the drum. At Drop it picks up from its last reading, never jumping up to a drum hotter than the beans: like the real Skywalker, which falls from its drop temperature (about 10 °C in the first 15 s) and never rises after Drop with the heater off. A heater left on still heats the empty drum. In the app, Start puts beans in and Drop or End takes them out.
- **Fitted to real roasts:** `pnpm fit:simulator <roast id>...` replays saved roasts' heater, fan and cooling through the model and finds the constants that match their BT best (least squares, read-only on the database). Readings with beans in count 20 times as much as preheat and cooling: a fit led by the long preheat and cooling matched those but ran a closed-loop Auto roast fast early and stalled it late. Rerun it on new roasts that start from a known drum (not one recorded mid-cool-down, like roast 17) and copy the result into `DEFAULT_THERMAL_CONSTANTS`; the test against roast 16 (`auto-simulation-real-roast.test.ts`) must still pass.

| Constant         | Default     | Effect                                          |
| ---------------- | ----------- | ----------------------------------------------- |
| Ambient          | 22 °C       | Start temperature and where it cools back to    |
| Heat gain        | 0.635 °C/s  | Rise per second at heater 100, before losses    |
| Room loss        | 0.000183 /s | Fraction of the gap to ambient lost per second  |
| Fan loss factor  | 3.86        | Fan 100 adds 3.86 times the loss                |
| Cool loss factor | 13.8        | Cooling 100 adds 13.8 times the loss            |
| Bean gain        | 0.0107 /s   | Beans close 1 % of the gap to the drum a second |
| Drum to beans    | 0.0098 /s   | What the drum loses to the beans                |
| Probe lag        | 38 s        | How slowly the probe follows the beans          |

Fitted to roasts 6, 7 (manual, 2026-11-04, 375 g), 15 and 16 (Auto, 2026-11-08, 356 g). Replayed open-loop, the RMS error from charge to drop went from 4.5 to 2.9 °C (roast 16: 4.5 → 1.9), and over every reading from 9.8 to 10.1 °C. A closed-loop Auto roast with roast 16's own profile and gains now stays within 2 °C of it every 30 s from 1:00 to drop, RoR within 2.3 °C/min from 1:30 (BT RMS 4.0 → 1.6 °C; roast 15: 6.8 → 2.7 °C), dry end 5:24 against 5:18 and first crack (190.5 °C) 9:45 against 9:29.

Known gaps:

- **Late RoR:** after the heat steps down near first crack, simulated RoR falls about 2 °C/min faster than the real drum's, so Auto holds about 10 % more heat there than the real roaster needed. A drum body that stores heat, a drying load and heat from the beans near first crack were each tried and fitted to nothing.
- **Charge dip:** the real dip depends on how soaked the drum is (roast 15, the first batch, turned at 84 °C; roast 16 at 89 °C). The simulator turns at 87 °C either way, and reads about 5 °C below roast 16 at 0:30.
- **Preheat and cooling:** fitted lightly, so they are about 10 °C RMS off; heater 100 never levels off below the 240 °C limit, as on the real roaster.

- **Faults for tests:** stall the reported temperature (like the sketch's stale readings), disconnect and reconnect, report another protocol version.
- **Deterministic:** no noise, no randomness; same inputs and clock give the same readings.

## Firmware in this repo

`firmware/skywalker-tc4/` may hold a copy of the sketch with its GPL-3.0 license and credit kept beside it. The app is a separate program that talks to it over serial, so the app's own license is unaffected.
