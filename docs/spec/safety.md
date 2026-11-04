# Safety

Every safety trip does the same thing: heater 0, fan 100, cooling on, loud alarm, and an event in
the roast log. Safety logic lives in the main process, separate from the controller, so a
controller bug can't bypass it. Limits are per roaster.

| Rule                | Default                                                                                                                                                                                                                                 | Action                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Max temperature     | 240 °C                                                                                                                                                                                                                                  | Safe stop                                                                                                             |
| Lost connection     | No valid reading for 3 s                                                                                                                                                                                                                | Alarm + safe stop now and again once readings are back; banner telling you to check the roaster                       |
| Max roast time      | 20 min after charge                                                                                                                                                                                                                     | Safe stop                                                                                                             |
| Stalled temperature | Rise under 1 °C in 60 s while heater ≥ 50%, or the exact same reading for 10 s while heating; in a roast the 60 s only count from the turning point (or from 3 min after charge if none is found), as the beans pull BT down until then | Alarm only; you decide (also catches the sketch's stale readings)                                                     |
| Computer sleep      | While a roaster is connected the app keeps the computer from idle sleep; while a roast runs (Preheat to Cooling, or the roaster cool-down) it also keeps the screen on, so it doesn't lock                                              | If it sleeps anyway (lid closed, Sleep chosen): safe stop and heater lock before it sleeps; sleep and wake are logged |
| App quit or crash   | —                                                                                                                                                                                                                                       | Send safe-stop commands on quit; the sketch's 10 s watchdog covers crashes                                            |

The app never claims it can be left alone. The roast screen says to stay with the roaster.

## How it works

- **One path to the roaster.** The app only ever talks to `SafetyGuardedDriver`, which wraps the real driver. Every reading and read failure passes through the `SafetyMonitor`, so no caller can skip it.
- **Checked every reading and every second.** The app also calls `check()` on its own 1 s timer, so lost connection trips even if polling stops.
- **Trips on the edge.** A rule trips when its condition becomes true and clears when it becomes false. Each trip and clear is an event (`SafetyTripped`, `SafetyCleared`) for the roast log and the UI.
- **Heater locked after a safe stop.** While locked, any heater value above 0 is refused with `safety-locked`; fan, cooling, drum and filter still work. The lock lifts only when you acknowledge and no safe-stop rule is still tripped. Max roast time stays tripped until the roast ends.
- **"Heating" means heater above 0.** The same-reading check starts counting when the heater turns on, so a steady idle temperature (seen on the real roaster: 29.98 °C for minutes) never alarms.
- **Armed while connected.** Lost connection can't trip before the roaster has connected, or after you disconnect on purpose.
- **Reconnects by itself.** After a lost connection the session tries to connect again every second; the second safe stop goes out with the first reading back.
- **Emergency stop.** Same as a safe-stop trip: safe stop, heater locked, and the same acknowledge to carry on. It holds nothing, so you can acknowledge straight away.
