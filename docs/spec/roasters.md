# Roasters (plug and play)

Everything roaster-specific lives in one roaster record. Switching the active roaster switches
the driver, limits, batch sizes, profiles and suggestions together. Profiles belong to a roaster
and never move between roasters on their own (see [roast-control.md](roast-control.md)).

| Roaster setting                  | Skywalker starting value                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| Driver + connection              | `Tc4Driver`, SkyCommand dialect, over USB serial                                    |
| Capabilities                     | Heater, fan, drum, cooling, filter                                                  |
| Batch size min / ideal / max (g) | 250 / 375 / 400                                                                     |
| Safety limits                    | 240 °C, 20 min                                                                      |
| PID gains, correction limit      | Tuned on real roasts; ±20%                                                          |
| Curve following                  | Look ahead 30 s, pull 0.3 °C/min per °C, heater at most 5% per 10 s, ±20%           |
| Temperature offset               | 0 °C                                                                                |
| Preheat hold                     | First batch 2:30, next batch 2:00 (within 20 min of the last roast), at charge temp |
| Bean cooler helps cool the drum  | On (the tray fan sits under the drum)                                               |
| Drum speed                       | – (its drum is only on or off)                                                      |
| Built-in profiles                | Skywalker set: Light · Steps, Light · Curve; Medium and Dark once Light is tuned    |

- Profiles, roasts and favourites belong to a roaster. A roaster model ships its own Light, Medium and Dark; an unknown model gets generic templates marked "needs calibration".
- The UI reads capabilities: a control the roaster doesn't have is hidden.
- **Drum kinds:** a model's drum is either on/off (Skywalker) or has a speed in % (Simulator). Each model declares its channels without connecting, so the Roasters page knows which it has.
- **Drum speed:** on a roaster whose drum has a speed, its usual speed, 5–100 % in steps of 5 (default 60 %). "Drum on" means this speed everywhere: Preheat, Start, bean and drum cooling, and outputs restored after a reconnect. The Roast screen slider changes it for the roast that's running; the next roast starts at the usual speed again. Hidden for an on/off drum.
- **Later:** a drum speed per profile step, so Auto can change it during the roast, once a real roaster with drum speed is tuned.
- Adding a roaster = pick an existing model and fill in the record. A new model = one model definition, its facts entry and one registry line ([extensibility.md](extensibility.md), Roaster models); a new kind of hardware also needs its driver class (`add-extension` skill).
- **The driver follows the model:** Connect builds the active roaster's model's driver. A connection of the wrong kind for that model (a port for the Simulator) is refused.

## First version (milestone 5)

- **Two records to start:** Skywalker and Simulator, made by the migration. Add another by picking a model and filling in the record; a Simulator is the only other model until a new driver ships.
- **In the record:** name, model, connection, batch min / ideal / max, safety limits, temperature offset, preheat holds (first batch and next batch, 1:30–3:00 each, [roast-control.md](roast-control.md)), PID gains, "Bean cooler helps cool the drum" (on for a Skywalker, off for the Simulator) and, for a drum with a speed, its drum speed. Batch min starts at 250 g; change it once you've tested smaller batches. The cooling times and the drum target stay in Settings.
- **Moving over:** the connection in Settings moves to the Skywalker or Simulator record on first start. Your own profiles and every saved roast move to the Skywalker record, simulator practice roasts included, as nothing recorded which roaster they used.
- **Active roaster:** one at a time. Connect uses it, and Connect on a roaster's page (Roasters screen) makes that roaster active first, and picking its port saves it on that record. Changing it, or its limits and gains, waits while it is connected. Its profiles, batch sizes and limits follow.
- **Limits:** the record's temperature and time limits replace the fixed ones, and can only be set at or below the model's own (Skywalker: 240 °C, 20 min).
- **Offset:** added to the temperature reading before anything else sees it, safety rules included.
- **Deleting:** a roaster with saved roasts or your own profiles can't be deleted, and neither can the active one.
- **Capabilities:** an output or switch the connected roaster doesn't have is hidden on the Roast screen.
- **Copy to another roaster:** on the Profiles screen, makes a copy there marked "needs calibration", named after the roaster it came from ("Light · Steps (from Simulator)", then "… 2" if that name is taken there), so it never passes for that roaster's own built-in. A roaster holds one copy of a profile: copying it again names the copy it already has instead. Copies run one at a time, so clicks in quick succession make one.

## Generic TC4

A model for home-built roasters on an Arduino + TC4 board with the stock firmware
([hardware.md](hardware.md#stock-tc4-firmware-aartisanq_pid)). One model covers them all: what differs
between builds is on the record, so a new build is a new record, not new code.

| Roaster setting                  | Generic TC4 starting value                                         |
| -------------------------------- | ------------------------------------------------------------------ |
| Driver + connection              | `Tc4Driver`, stock TC4 dialect, over USB serial                    |
| Capabilities                     | Heater, fan; BT, and ET when wired. No drum, bean cooler or filter |
| Batch size min / ideal / max (g) | 100 / 150 / 250 (change them to fit your roaster)                  |
| Safety limits                    | 250 °C, 20 min (the model's own; the record can only go lower)     |
| PID gains                        | The Skywalker's as a start; tune them on your roaster              |
| Preheat hold                     | First batch 2:30, next batch 2:00                                  |
| Bean cooler helps cool the drum  | Off (there is none)                                                |
| Built-in profiles                | None: generic templates marked "needs calibration"                 |

**Wiring** (its own card on the roaster's page, between the connection and the record; Generic TC4 only):

| Setting                   | Choices                           | Default |
| ------------------------- | --------------------------------- | ------- |
| Bean probe (BT)           | TC1–TC4                           | TC2     |
| Environment probe (ET)    | TC1–TC4, or None                  | TC1     |
| Heater output             | OT1, IO3                          | OT1     |
| Fan output                | OT2 (AC fan), IO3 (DC fan)        | OT2     |
| Baud                      | 9600, 19200, 38400, 57600, 115200 | 115200  |
| Minimum fan while heating | 0–100 %, steps of 5; 0 = off      | 0       |

- **Never two on one:** BT and ET never share an input, nor heater and fan an output. Picking the bean probe's input for ET isn't offered; picking ET's input for the bean probe swaps the two; picking IO3 for the heater moves a fan there to OT2, and IO3 for the fan moves a heater there to OT1. Main checks it again (`Tc4WiringSchema`).
- **Pick the probe by its reading:** while this roaster is connected and no roast or drum cooling runs, the card shows TC1–TC4 live (every 2 s), "BT" and "ET" under theirs, so you can warm one probe in your hand and see which it is.
- **Saves as you pick:** setting rows, like Settings, no Edit. Unlike the rest of the record they can change while connected, never while a roast or drum cooling runs ("Waits until the roast ends"). Saving the connected roaster's wiring reconnects it with the new wiring (a safe stop, then Connect); a failed reconnect leaves the wiring saved and shows in the connection card.
- **Minimum fan while heating:** for air roasters (poppers, heat guns), whose heater burns out with too little air. While the heater is above 0, the fan is never below it: a heater command raises the fan to it first (and stays off if the fan can't), and a lower fan is held at it ([safety.md](safety.md)). Off (0) for drum roasters. A select: Off, then 5 % steps.
- **Drop and cooling without a cooler or drum:** Drop sets heater 0 and fan 100; bean and drum cooling run on the fan alone, and safe stop is heater 0, fan 100. The roast flow sends nothing to an output the connected roaster doesn't have, and the record has no "Bean cooler helps cool the drum".
- **No watchdog on the board:** a crash or a pulled cable leaves the heater on ([safety.md](safety.md)). No extra step in the app for it: the safety notice already says to stay with the roaster.
- **Not now:** drum, cooler or other outputs (a new dialect), tuned built-in profiles for one popular build (a model of its own), charge ET in Preheat.
