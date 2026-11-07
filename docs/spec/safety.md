# Safety

Every safety trip does the same thing: heater 0, fan 100, bean cooler on, loud alarm, and an event in
the roast log. Safety logic lives in the main process, separate from the controller, so a
controller bug can't bypass it. Limits are per roaster.

| Rule                | Default                                                                                                                                                                                                                                 | Action                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Max temperature     | 240 °C                                                                                                                                                                                                                                  | Safe stop                                                                                                                                |
| Lost connection     | No valid reading for 3 s                                                                                                                                                                                                                | Alarm + safe stop now and again once readings are back; banner telling you to check the roaster                                          |
| Max roast time      | 20 min after charge                                                                                                                                                                                                                     | Safe stop                                                                                                                                |
| Stalled temperature | Rise under 1 °C in 60 s while heater ≥ 50%, or the exact same reading for 10 s while heating; in a roast the 60 s only count from the turning point (or from 3 min after charge if none is found), as the beans pull BT down until then | Alarm only; you decide (also catches the sketch's stale readings)                                                                        |
| Computer sleep      | While a roaster is connected the app keeps the computer from idle sleep; while a roast runs (Preheat to Cooling, or drum cooling) it also keeps the screen on, so it doesn't lock                                                       | If it sleeps anyway (lid closed, Sleep chosen): safe stop and heater lock before it sleeps; sleep and wake are logged                    |
| App quit or crash   | —                                                                                                                                                                                                                                       | Send safe-stop commands on quit; a crash also tries to save the roast in progress, within 2 s; the sketch's 10 s watchdog covers crashes |

The app never claims it can be left alone. The roast screen says to stay with the roaster.

## Safety notice

The first time the app opens, the whole window shows the safety notice before anything else, so nobody connects a roaster without reading it.

- **What it says:** a centred card: the mark, "Roastpilot switches a heater", "Use it at your own risk", then four one-line points with an icon each: Stay with the roaster · in Manual and in Auto; Auto is not a safety device; Keep the fuses, cut-outs and watchdog in place; Free software · no warranty (GPL-3.0). One full-width button: **I understand · continue**.
- **Nothing else is reachable** until you accept: no top bar, no screens. No roast can be running then, as the app never connects by itself.
- **Asked once:** accepting saves the notice's version in `settings.json` (`safetyNoticeAccepted`). It shows again only when the wording changes and its version goes up.
- **If saving fails:** you still continue for this run; an error toast says "Couldn't save · the safety notice shows again next launch".
- **Read it again:** Help → Safety notice shows it in the screen area, under the top bar and banners (Emergency stop stays on screen), with **Close** instead of the accept button; allowed mid-roast, the roast keeps running.

## Auto mode

Auto goes through the same `SafetyGuardedDriver` as every other command, so it can't get past the rules or the heater lock.

| When                                                              | Auto does                                                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Any safe stop: a rule, Emergency stop or sleep                    | Hands heater and fan to manual at once and sends nothing more. After you acknowledge, you press Resume auto                           |
| Lost connection, or a disconnect                                  | The same. Readings coming back restore the phase's outputs (heater 0), not Auto                                                       |
| Auto itself fails: an error, or Drop refused                      | Sets a heater it owns to 0, then the same: both outputs manual, until Resume auto                                                     |
| Heater 0 from Auto fails (Drop, a preheat limit, its own failure) | Sent again on every reading until the roaster takes it, you set the heater yourself, or the next preheat or roast sets it             |
| A command never answers                                           | Later readings are skipped (one at a time), and logged once after 5 s; the driver's reply timeout and the lost-connection rule end it |
| Stalled temperature (alarm only)                                  | Keeps running; you decide                                                                                                             |
| A heater or fan command fails                                     | Logged, tried again at the next change or second; the lost-connection rule covers a roaster that stopped                              |
| You touch heater or fan                                           | That output goes manual, the other stays on Auto, until Resume auto                                                                   |
| Resume auto                                                       | Refused while the heater is locked; otherwise picks up the current phase from the live reading                                        |

Auto never turns the heater back on by itself after a stop. Time limits on the preheat are in [roast-control.md](roast-control.md). The app still never claims it can be left alone: the roast screen says to stay with the roaster in Auto too.

## How it works

- **One path to the roaster.** The app only ever talks to `SafetyGuardedDriver`, which wraps the real driver. Every reading and read failure passes through the `SafetyMonitor`, so no caller can skip it.
- **Checked every reading and every second.** The app also calls `check()` on its own 1 s timer, so lost connection trips even if polling stops.
- **Trips on the edge.** A rule trips when its condition becomes true and clears when it becomes false. Each trip and clear is an event (`SafetyTripped`, `SafetyCleared`) for the roast log and the UI.
- **Heater locked after a safe stop.** While locked, any heater value above 0 is refused with `safety-locked`; fan, bean cooler, drum and filter still work. The lock lifts only when you acknowledge and no safe-stop rule is still tripped. Max roast time stays tripped until the roast ends.
- **"Heating" means heater above 0.** The same-reading check starts counting when the heater turns on, so a steady idle temperature (seen on the real roaster: 29.98 °C for minutes) never alarms.
- **Armed while connected.** Lost connection can't trip before the roaster has connected, or after you disconnect on purpose.
- **Reconnects by itself.** After a lost connection the session tries to connect again every second; the second safe stop goes out with the first reading back.
- **Emergency stop.** Same as a safe-stop trip: safe stop, heater locked, and the same acknowledge to carry on. It holds nothing, so you can acknowledge straight away.
