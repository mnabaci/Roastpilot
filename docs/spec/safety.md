# Safety

Every safety trip does the same thing: heater 0, fan 100, cooling on, loud alarm, and an event in
the roast log. Safety logic lives in the main process, separate from the controller, so a
controller bug can't bypass it. Limits are per roaster.

| Rule                | Default                                                                        | Action                                                                           |
| ------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Max temperature     | 240 °C                                                                         | Safe stop                                                                        |
| Lost connection     | No valid reading for 3 s                                                       | Alarm + safe stop once the port is back; banner telling you to check the roaster |
| Max roast time      | 20 min after charge                                                            | Safe stop                                                                        |
| Stalled temperature | Rise under 1 °C in 60 s while heater ≥ 50%, or the exact same reading for 10 s | Alarm only; you decide (also catches the sketch's stale readings)                |
| App quit or crash   | —                                                                              | Send safe-stop commands on quit; the sketch's 10 s watchdog covers crashes       |

The app never claims it can be left alone. The roast screen says to stay with the roaster.
