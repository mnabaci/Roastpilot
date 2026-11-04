# Manual mode with live coach

- Switch between Auto and Manual at any time. In Manual you set heater and fan.
- A coach card shows the next suggested setting, the reason and an Apply button: "Heater 65% → 75% · 4 °C below target, RoR falling".
- Suggestions come from the same phase plan and PID trim running in the background, so Manual and Auto never disagree: "Next step at 150 °C: heat 65%, fan 50%".
- At most one new suggestion every 15 s, and only when it differs by 10% or more.
- Milestone nudges: first crack expected soon (from the ghost), drop temp approaching.
- All safety rules apply in Manual mode too.

## Manual roast flow

Until Auto mode exists (milestone 4), a roast is driven by hand through these states. The flow
lives in `core` (`ManualRoast`) and runs in main, so a closed window changes nothing.

| State       | Entered by                          | What the app does                                              | Next action (Guided) |
| ----------- | ----------------------------------- | -------------------------------------------------------------- | -------------------- |
| Ready       | Connecting                          | Nothing runs                                                   | Preheat              |
| Preheat     | Preheat                             | Drum on; preheat clock starts                                  | Start (beans in)     |
| Roasting    | Start                               | Clock starts at 0; max roast time armed                        | First crack          |
| Development | First crack                         | Records time and BT; development timer starts                  | Drop                 |
| Cooling     | Drop (from Roasting or Development) | Heater 0, fan 100, cooling 100; "Dump beans"; 4 min countdown  | –                    |
| Done        | Cooling time ends                   | Heater 0, fan 0, cooling 0, drum off                           | Preheat (next batch) |
| Ready       | Cancel preheat (from Preheat)       | Heater 0, fan 0, cooling 0, drum off; the preheat is forgotten | Preheat              |

- **Drum:** on at Preheat, off when cooling ends. A drum switch is always on screen to override it.
- **Numbers:** BT, RoR (°C/min, slope of the last 30 s of BT), time, development time and its % of the roast. Time counts the preheat ("2:30 · In preheat") until charge, then the time since charge. A value that rounds to zero shows as 0.0, never -0.0.
- **Stage times:** each finished stage in the stepper shows how long it took: Preheat (to charge), Roast (charge to first crack), First crack (first crack to drop, with its % of the roast) and Cool.
- **Preheat hint:** "Drum on · set the heater to warm up, then add beans." Preheat never sets the heater; you do.
- **Cancel preheat:** a secondary button under Start while preheating. No confirm: Preheat is one press away.
- **Not saved yet:** readings and events stay in memory for the current roast; saving arrives with Logging (milestone 3). Main keeps them, so reloading the window keeps the chart.
- An emergency stop or safety trip doesn't change the state; you decide what to do next.

## Guided and Full control

A setting, not a mode: it only changes how much of the screen is live.

| Level            | Heater and fan           | Cooling switch | Drum switch |
| ---------------- | ------------------------ | -------------- | ----------- |
| Guided (default) | From Preheat until Drop  | Hidden         | Shown       |
| Full control     | Any time while connected | Shown          | Shown       |

- Guided keeps one obvious next action: Connect → Preheat → Start → First crack → Drop.
- Full control still has the flow buttons for timing; it just doesn't wait for them.
- Heater above 0 with the drum off shows one line: "Drum is off". It doesn't block.
- Sliders show what you set until the roaster reports a change (at most 2 s), then follow the readings, so Drop or a safety stop always shows the real value.
