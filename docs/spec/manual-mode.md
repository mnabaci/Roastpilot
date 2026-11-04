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

| State       | Entered by                          | What the app does                                                             | Next action (Guided) |
| ----------- | ----------------------------------- | ----------------------------------------------------------------------------- | -------------------- |
| Ready       | Connecting                          | Nothing runs                                                                  | Preheat              |
| Preheat     | Preheat                             | Drum and filter fan on; preheat clock starts                                  | Start (beans in)     |
| Roasting    | Start                               | Clock starts at 0; max roast time armed                                       | First crack          |
| Development | First crack                         | Records time and BT; development timer starts                                 | Drop                 |
| Cooling     | Drop (from Roasting or Development) | Heater 0, fan 100, cooling 100; "Dump beans"; 4 min countdown                 | –                    |
| Done        | Cooling time ends                   | Heater 0, fan 0, cooling 0, drum and filter fan off                           | Preheat (next batch) |
| Ready       | End roast (from Preheat)            | Heater 0, fan 0, cooling 0, drum and filter fan off; the preheat is forgotten | Preheat              |
| Done        | End roast (Roasting or Development) | Heater 0, fan 0, cooling 0, drum and filter fan off; records an `end` event   | Preheat (next batch) |
| Done        | Finish cooling now (Cooling)        | As when cooling time ends, now                                                | Preheat (next batch) |

- **Drum and filter fan:** on at Preheat (or Start), off when cooling ends. Their switches are always on screen to override them; the filter fan runs at level 1, as Artisan sends it (it takes levels 0–4; 100 stops the roaster's fans responding).
- **Numbers:** BT, RoR (°C/min, least-squares slope of the last 30 s of BT; after charge only readings since charge count, so it shows a dash for the first 30 s instead of the dip at charge), time, development time and its % of the roast. Time counts the preheat ("2:30 · In preheat") until charge, then the time since charge. A value that rounds to zero shows as 0.0, never -0.0.
- **Stage times:** each finished stage in the stepper shows how long it took: Preheat (to charge), Roast (charge to first crack), First crack (first crack to drop, with its % of the roast) and Cool. A step the roast went past without it happening (no first crack before Drop; Drop and Cool after End roast) is grey and says Skipped.
- **Preheat hint:** "Drum and filter on · set the heater to warm up, then add beans." Preheat never sets the heater; you do.
- **End roast:** the one normal stop, a quiet button at the bottom of the flow panel in Preheat, Roasting and Development ("End roast") and Cooling ("Finish cooling now"). In Preheat it goes back to Ready (nothing roasted yet); later it goes to Done. It asks once inline ("End the roast? · everything turns off"), then stops normally: no heater lock and no banner, unlike Emergency stop. The roast is saved up to that moment and counts as finished.
- **Clear:** a quiet button in the flow panel in Ready and Done, shown when the chart has readings. It empties the chart and numbers for a fresh start without preheating (Preheat clears them too); the saved roast stays in History.
- **Saved:** every roast saves itself (docs/spec/data-model.md, Saving a roast). Main also keeps the current roast in memory, so reloading the window keeps the chart.
- **Outputs hint (Guided):** while the heater and fan sliders are locked, one line says why: "Heater and fan wait for Preheat" in Ready and Done, "Cooling · heater off, fan at 100%" in Cooling.
- An emergency stop or safety trip doesn't change the state; you decide what to do next.

## Guided and Full control

A setting, not a mode: it only changes how much of the screen is live.

| Level            | Heater and fan           | Cooling switch | Drum and filter switches |
| ---------------- | ------------------------ | -------------- | ------------------------ |
| Guided (default) | From Preheat until Drop  | Hidden         | Shown                    |
| Full control     | Any time while connected | Shown          | Shown                    |

- Guided keeps one obvious next action: Connect → Preheat → Start → First crack → Drop.
- Full control still has the flow buttons for timing; it just doesn't wait for them.
- Heater above 0 with the drum off shows one line: "Drum is off". It doesn't block.
- Sliders show what you set until the roaster reports a change (at most 2 s), then follow the readings, so Drop or a safety stop always shows the real value.
