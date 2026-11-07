# Manual mode with live coach

- Switch between Auto and Manual at any time. In Manual you set heater and fan.
- A coach card shows the next suggested setting, the reason and an Apply button: "Heater 65% → 75% · 4 °C below target, RoR falling".
- Suggestions come from the same phase plan and PID running in the background, so Manual and Auto never disagree: "Next step at 150 °C: heat 65%, fan 50%".
- At most one new suggestion every 15 s, and only when it differs by 10% or more.
- Milestone nudges: first crack expected soon (from the ghost), drop temp approaching.
- All safety rules apply in Manual mode too.

## Manual roast flow

A roast moves through these states, by hand or with Auto mode driving heater and fan
([roast-control.md](roast-control.md)). The flow lives in `core` (`ManualRoast`) and runs in main,
so a closed window changes nothing.

| State       | Entered by                          | What the app does                                                                                                         | Next action (Guided) |
| ----------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Ready       | Connecting                          | Nothing runs                                                                                                              | Preheat              |
| Preheat     | Preheat                             | Drum and filter fan on; preheat clock starts                                                                              | Start (beans in)     |
| Roasting    | Start                               | Clock starts at 0 (at the charge point found, see below); max roast time armed                                            | First crack          |
| Development | First crack                         | Records time and BT; development timer starts                                                                             | Drop                 |
| Cooling     | Drop (from Roasting or Development) | Heater 0, fan 100, bean cooler on; "Dump beans"; bean cooling countdown; drum cooling starts too (see Drum cooling)       | –                    |
| Done        | Bean cooling ends                   | Bean cooler and filter fan off; drum cooling, when on, carries on until the drum is below its target; else everything off | Preheat (next batch) |
| Ready       | End roast (from Preheat)            | Heater 0, fan 0, bean cooler off, drum and filter fan off; nothing is saved, the preheat stays on the chart until Clear   | Preheat              |
| Done        | End roast (Roasting or Development) | Heater 0, fan 0, bean cooler off, drum and filter fan off; records an `end` event                                         | Preheat (next batch) |
| Done        | Finish cooling now (Cooling)        | As when bean cooling ends, now; drum cooling carries on                                                                   | Preheat (next batch) |
| Cooling     | +1 min (Cooling)                    | One more minute on the bean cooling countdown                                                                             | –                    |

- **Charge point:** you often press Start a few seconds after the beans go in. On Start the app looks back over the last 60 s of readings for the charge drop, with Artisan's auto-CHARGE test (`BTbreak`, at 1 s readings): BT above 77 °C, and after a point the next two readings each fall at least 0.67 °C and their average fall is clearly steeper than the trend before it (more than 0.5 + 2.5 × the earlier slope, capped at 6.4 °C; or BT was rising before and the rise plus the fall is more than 0.78 °C); if no 1 s break shows, the same test on every other reading over 10 s, with each fall at least 1.0 °C. Charge is set to the earliest such point (the last reading before the fall); with none it is the moment you pressed. The roast clock, RoR, max roast time and the saved roast all count from it, and the Roasting hint says "Charge found 0:12 before you pressed" until first crack. A setting ("Find the charge point"), on by default.
- **Turning point:** the lowest BT between charge and now, found by itself as Artisan does: at least 20 s after charge, once none of the last four raw readings is below the reading before them (and the last is above it), the turning point is the lowest reading since charge. It only counts between 50 and 150 °C, so a probe glitch never marks it, and it is looked for until first crack. It is recorded as a `turning-point` event with its time and BT, marked TP on the chart and listed in History. Nothing to press.
- **Two coolings:** the bean cooler (the tray fan, `COOL`) cools the beans dumped on the tray; the main fan blows air through the empty drum to cool the roaster. Both start at Drop and each ends on its own signal. The roast is finished, and the review card shows, once the beans are cool.
- **Bean cooling:** by time only, a setting "Cool the beans for" 2, 3, 4, 5 or 6 min (default 4), taken at Drop. In Cooling, a quiet "+1 min" button next to Finish cooling now adds a minute, for big batches. A temperature can't end it: after Drop the probe is in the empty drum, not in the beans. (An older "by temperature" setting is read as by time.)
- **Drum cooling:** heater 0, fan 100, drum on, until BT (the drum's own temperature here) is below the target, then those turn off too. Two settings: "Cool the drum after each roast", on by default, and the target, "Cool the drum to" 40, 50, 60 or 70 °C (default 50 °C), taken when it starts. With the setting on it starts at Drop. In Ready and Done, with BT 10 °C or more above the target and no drum cooling running, "Cool the drum" (secondary, under Preheat) starts the same thing. While it runs, the flow panel says "Cooling the drum · 92 °C → 50 °C" with a quiet Stop (in Done next to the review card). It only starts while the roaster is connected and not locked by a safety stop. Preheat or Start (fan back to 0), Stop, turning the heater on (your outputs stay as set), disconnecting and any safety stop end it; Finish cooling now doesn't. It gives up 20 min after Drop, or 15 min after "Cool the drum" (logged), so a stuck probe can't keep the fan running for ever.
- **Bean cooler helps cool the drum:** a per-roaster switch (Roasters page), on for the Skywalker, whose tray fan sits under the drum. With it on, the bean cooler stays on after the beans are done while drum cooling runs, and turns off with it. Off, it turns off with bean cooling.
- **Outputs while cooling** come from what is running, never from a fixed list: bean cooling sets heater 0, fan 100, bean cooler on, drum and filter fan on; drum cooling sets heater 0, fan 100, drum on; the bean cooler stays on for drum cooling as above; with neither running everything is off.
- **Drum and filter fan:** on at Preheat (or Start); a drum with a speed turns at the roaster's usual speed ([roasters.md](roasters.md), Drum speed); off when bean cooling ends (the drum keeps turning while drum cooling runs). Their switches are always on screen to override them; the filter fan runs at level 1, as Artisan sends it (it takes levels 0–4; 100 stops the roaster's fans responding).
- **After a reconnect:** a new connection (or readings back after a lost one) starts with the roaster's outputs off, so the roast puts its phase's outputs back: drum and filter fan from Preheat to Development; in Cooling and during drum cooling, the outputs of the coolings running (Outputs while cooling). Never the heater above 0, and a switch you changed by hand comes back to the phase's value. Ready and Done with no drum cooling send nothing.
- **Numbers:** BT, RoR (°C/min, least-squares slope of the last 30 s of BT; after charge only readings since charge count, so it shows a dash for the first 30 s instead of the dip at charge), time, development time and its % of the roast. Time counts the preheat ("2:30 · In preheat") until charge, then the time since charge. A value that rounds to zero shows as 0.0, never -0.0.
- **Stage times:** each finished stage in the stepper shows how long it took: Preheat (to charge), Roast (charge to first crack), First crack (first crack to drop, with its % of the roast) and Cool. A step the roast went past without it happening (no first crack before Drop; Drop and Cool after End roast) is grey and says Skipped.
- **Preheat hint:** "Drum and filter on · set the heater to warm up, then add beans." Preheat never sets the heater; you do.
- **End roast:** the one normal stop, a secondary button at the bottom of the flow panel in Preheat, Roasting and Development ("End roast") and Cooling ("Finish cooling now"). End roast is set apart by a divider, with a stop icon and amber text (`warning`): easy to find, never the red of Emergency stop. In Preheat it goes back to Ready (nothing roasted yet); later it goes to Done. It asks once in a dialog with the same icon: "End the roast?", what happens in up to 3 lines (heater, fan, drum and filter off now; in Preheat: back to Ready, the preheat isn't saved; later: no bean cooling, dump the beans yourself, the roast is saved as it is), then "Keep roasting" (focused) or "End roast" in amber. Finish cooling now keeps the plain question ("Finish cooling the beans? · the countdown ends now"), then stops normally: no heater lock and no banner, unlike Emergency stop. The roast is saved up to that moment and counts as finished.
- **Clear:** a quiet button at the right end of the stepper row in Ready and Done, shown when a roast or a preheat is on screen, connected or not (idle readings alone don't count, so it doesn't come back a second after you press it). It resets the whole view (stepper, numbers and chart) in the app and in the window, without preheating (Preheat resets it too); the saved roast stays in History. While connected, the chart then starts again from the live idle temperature, as it does before any roast.
- **Saved:** every roast saves itself (docs/spec/data-model.md, Saving a roast). Main also keeps the current roast in memory, so reloading the window keeps the chart.
- **Outputs hint (Guided):** while a slider is locked, one line says why: "Heater waits for Preheat" in Ready and Done, "Cooling beans · heater off, fan at 100%" in Cooling.
- An emergency stop or safety trip doesn't change the state; you decide what to do next.

## Guided and Full control

A setting, not a mode: it only changes how much of the screen is live.

| Level            | Heater                   | Fan                                  | Bean cooler switch | Drum and filter switches |
| ---------------- | ------------------------ | ------------------------------------ | ------------------ | ------------------------ |
| Guided (default) | From Preheat until Drop  | From Preheat until Drop, Ready, Done | In Ready and Done  | Shown                    |
| Full control     | Any time while connected | Any time while connected             | Shown              | Shown                    |

- With no roast running (Ready and Done) Guided lets you run everything but the heater, so you can cool or clean the roaster.
- Guided keeps one obvious next action: Connect → Preheat → Start → First crack → Drop.
- Full control still has the flow buttons for timing; it just doesn't wait for them.
- Heater above 0 with the drum off shows one line: "Drum is off". It doesn't block.
- Sliders send when you let go, as Artisan's do (dragging moves only the number); with the keyboard, 300 ms after the last key press. The values in between are never sent, so the roaster and the chart's outputs strip only ever see what you chose.
- Sliders show what you set until the roaster reports a change (at most 2 s), then follow the readings, so Drop or a safety stop always shows the real value.
