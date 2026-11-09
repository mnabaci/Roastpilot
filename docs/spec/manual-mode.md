# Manual mode with live coach

- Switch between Auto and Manual at any time. In Manual you set heater and fan.
- A coach card suggests the next setting while you roast by hand (see [Coach](#coach)).
- All safety rules apply in Manual mode too.

## Coach

In a manual roast, a card above the heater and fan sliders suggests what Auto would do now, and why, with **Apply**: "Heater 65% → 75% · 4 °C below target, RoR falling".

- **Where it comes from:** the profile picked for Auto (the setup card) runs in the background from Start, with the same phases and heat control as Auto ([roast-control.md](roast-control.md)), so Manual and Auto never disagree. It never sends anything to the roaster. Whenever you set the heater (by hand or with Apply), it starts again from your setting, as Resume auto does, so a suggestion is always a step from where you are, not from where Auto would have been.
- **When:** from Start until Drop (Roasting and Development), while the roast is Manual, connected and not locked by a safety stop. Not in Preheat: the Preheat hint already says to set the heater yourself.
  - Not during the soak at charge: Auto's soak is its own way to start, not advice for a manual charge. Settings are suggested from the moment the soak ends; heads-ups still come.
- **How often:** at most one new suggestion every 15 s, and only when it differs from what is set by 10 % or more (heater or fan). One card can carry both, one row each: Heater 65% → 75%, then Fan 50% → 40%.
- **Why, in one line:** on a curve phase, the gap to the curve and the RoR trend ("4 °C below target, RoR falling"); on a step phase, the RoR against the step's range ("RoR 6.5 · step wants 8–12"); at a phase change, its name ("Maillard from 150 °C"). A roast with the stall guard tripped says so ("RoR stalling").
  - "At a phase change" is the first 30 s of a phase, and "from" is BT when it began; a fixed phase always gives its name. The trend compares RoR now with RoR 20 s ago: a change under 1 °C/min either way is steady.
  - What is set is your value for 2 s after you set it, then what the roaster reports. A card keeps its numbers (and reason) until a new suggestion replaces it; one that no longer starts from what is set goes.
- **Apply:** sets the suggested heater and fan through the same path as the sliders, so every safety rule applies, and records a `coach-applied` event (detail: each output with from and to, "heater 65→75"). The card goes away until the next suggestion.
  - Apply names the card you saw: a card that has changed or gone is refused ("The suggestion changed · check the card"). Heater goes first; an output the roaster refuses stops it there, as does a roast that no longer allows Apply by the time the fan's turn comes (Drop, a switch to Auto, a stop), so Drop's cooling fan is never overwritten; only what was set is recorded.
- **Dismiss:** hides that suggestion until the next phase, or until the coach wants something 10 % or more further from what is set than the one you dismissed. An output that wasn't on the card counts from how far it was when you dismissed. A dismissed heads-up stays away for the rest of that roast.
- **Heads-ups (no Apply, Dismiss only), when no setting is suggested:**
  - "First crack in ~45 s · listen": in Roasting with no first-crack tap, once BT is within 60 s of the expected first crack at the current RoR. Expected first crack is the same as for the Listen for first crack sound ([ui.md](ui.md#sounds)); without one, no heads-up.
  - "Drop in ~30 s · 1:45 development": in Development, 30 s before the profile's development time; or "BT cap 225 °C in ~30 s" when BT will reach the cap first at the current RoR.
  - Seconds count down in steps of 5 s. With RoR at 0 or below there is no first-crack or cap heads-up; once BT reaches the expected first crack, or the development time has passed, the heads-up goes.
- **Needs calibration:** with a profile that needs calibration, the card's label says so in one line ("Coach suggests · needs calibration"; the setup card names the profile), so you weigh its advice.
- **Off:** a setting, Settings › Roast "Coach in manual roasts", on by default. Off, Manual looks as it does without a coach.
- **Gone:** at Drop, a switch to Auto, a disconnect or a safety stop the card disappears at once.

## Manual roast flow

A roast moves through these states, by hand or with Auto mode driving heater and fan
([roast-control.md](roast-control.md)). The flow lives in `core` (`ManualRoast`) and runs in main,
so a closed window changes nothing.

| State       | Entered by                           | What the app does                                                                                                         | Next action (Guided) |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Ready       | Connecting                           | Nothing runs                                                                                                              | Preheat              |
| Preheat     | Preheat                              | Drum and filter fan on; preheat clock starts                                                                              | Start (beans in)     |
| Roasting    | Start                                | Clock starts at 0 (at the charge point found, see below); max roast time armed                                            | First crack          |
| Development | First crack                          | Records time and BT; development timer starts                                                                             | Drop                 |
| Cooling     | Drop (from Roasting or Development)  | Heater 0, fan 100, bean cooler on; "Dump beans"; bean cooling countdown; drum cooling starts too (see Drum cooling)       | –                    |
| Done        | Bean cooling ends                    | Bean cooler and filter fan off; drum cooling, when on, carries on until the drum is below its target; else everything off | Preheat (next batch) |
| Ready       | Stop preheat (from Preheat)          | Heater 0, fan 0, bean cooler off, drum and filter fan off; nothing is saved, the preheat stays on the chart until Clear   | Preheat              |
| Done        | Stop roast (Roasting or Development) | Heater 0, fan 0, bean cooler off, drum and filter fan off; records an `end` event                                         | Preheat (next batch) |
| Done        | Finish cooling now (Cooling)         | As when bean cooling ends, now; drum cooling carries on                                                                   | Preheat (next batch) |
| Cooling     | +1 min (Cooling)                     | One more minute on the bean cooling countdown                                                                             | –                    |

- **Charge point:** you often press Start a few seconds after the beans go in. On Start the app looks back over the last 60 s of readings for the charge drop, with Artisan's auto-CHARGE test (`BTbreak`, at 1 s readings): BT above 77 °C, and after a point the next two readings each fall at least 0.67 °C and their average fall is clearly steeper than the trend before it (more than 0.5 + 2.5 × the earlier slope, capped at 6.4 °C; or BT was rising before and the rise plus the fall is more than 0.78 °C); if no 1 s break shows, the same test on every other reading over 10 s, with each fall at least 1.0 °C. Charge is set to the earliest such point (the last reading before the fall); with none it is the moment you pressed. The roast clock, RoR, max roast time and the saved roast all count from it, and the Roasting hint says "Charge found 0:12 before you pressed" until first crack. A setting ("Find the charge point"), on by default.
- **Turning point:** the lowest BT between charge and now, found by itself as Artisan does: at least 20 s after charge, once none of the last four raw readings is below the reading before them (and the last is above it), the turning point is the lowest reading since charge. It only counts between 50 and 150 °C, so a probe glitch never marks it, and it is looked for until first crack. It is recorded as a `turning-point` event with its time and BT, marked TP on the chart and listed in History. Nothing to press.
- **Two coolings:** the bean cooler (the tray fan, `COOL`) cools the beans dumped on the tray; the main fan blows air through the empty drum to cool the roaster. Both start at Drop and each ends on its own signal. The roast is finished, and the review card shows, once the beans are cool.
- **Bean cooling:** by time only, a setting "Cool the beans for" 2, 3, 4, 5 or 6 min (default 4), taken at Drop. In Cooling, a quiet "+1 min" button next to Finish cooling now adds a minute, for big batches. A temperature can't end it: after Drop the probe is in the empty drum, not in the beans. (An older "by temperature" setting is read as by time.)
- **Drum cooling:** heater 0, fan 100, drum on, until BT (the drum's own temperature here) is below the target, then those turn off too. Two settings: "Cool the drum after each roast", on by default, and the target, "Cool the drum to" 40, 50, 60 or 70 °C (default 50 °C), taken when it starts. With the setting on it starts at Drop. In Ready and Done, with BT 10 °C or more above the target and no drum cooling running, "Cool the drum" (secondary, under Preheat) starts the same thing. While it runs, the flow panel says "Cooling the drum · 92 °C → 50 °C" with a quiet Stop (in Done next to the review card). It only starts while the roaster is connected and not locked by a safety stop. Preheat or Start (fan back to 0), Stop, turning the heater on (your outputs stay as set), disconnecting and any safety stop end it; Finish cooling now doesn't. It gives up 20 min after Drop, or 15 min after "Cool the drum" (logged), so a stuck probe can't keep the fan running for ever.
- **Bean cooler helps cool the drum:** a per-roaster switch (Roasters page), on for the Skywalker, whose tray fan sits under the drum. With it on, the bean cooler stays on after the beans are done while drum cooling runs, and turns off with it. Off, it turns off with bean cooling.
- **Outputs while cooling** come from what is running, never from a fixed list: bean cooling sets heater 0, fan 100, bean cooler on, drum and filter fan on; drum cooling sets heater 0, fan 100, drum on; the bean cooler stays on for drum cooling as above; with neither running everything is off.
- **Drum and filter fan:** on at Preheat (or Start); a drum with a speed turns at the roaster's usual speed ([roasters.md](roasters.md), Drum speed); off when bean cooling ends (the drum keeps turning while drum cooling runs). Their switches are always on screen to override them; the filter fan runs at level 1, as Artisan sends it (it takes levels 0–4; 100 stops the roaster's fans responding).
- **After a reconnect:** a new connection (or readings back after a lost one) starts with the roaster's outputs off, so the roast puts its phase's outputs back: drum and filter fan from Preheat to Development; in Cooling and during drum cooling, the outputs of the coolings running (Outputs while cooling). Never the heater above 0, and a switch you changed by hand comes back to the phase's value. Ready and Done with no drum cooling send nothing.
- **Numbers:** BT, RoR (°C/min, least-squares slope of the last 30 s of BT; only readings since charge count, so it shows a dash in preheat, as the chart draws no RoR there, and for the first 30 s after charge instead of the dip at charge), time, development time and its % of the roast. Time counts the preheat ("2:30 · In preheat") until charge, then the time since charge. A value that rounds to zero shows as 0.0, never -0.0.
- **Stage times:** each finished stage in the stepper shows how long it took: Preheat (to charge), Roast (charge to first crack), First crack (first crack to drop, with its % of the roast) and Cool. A step the roast went past without it happening (no first crack before Drop; Drop and Cool after Stop roast) is grey and says Skipped.
- **Preheat hint:** "Drum and filter on · set the heater to warm up, then add beans." Preheat never sets the heater; you do.
- **Stop:** the one normal stop, a secondary button at the bottom of the flow panel, named by the phase: "Stop preheat" in Preheat, "Stop roast" in Roasting and Development, "Finish cooling now" in Cooling. Stop preheat and Stop roast are set apart by a divider, with a stop icon and amber text (`warning`): easy to find, never the red of Emergency stop. Stop preheat goes back to Ready (nothing roasted yet); Stop roast goes to Done. Each asks once in a dialog with the same icon: "Stop the preheat?" (heater, fan, drum and filter off now; back to Ready · nothing is saved; "Keep preheating" or "Stop preheat") or "Stop the roast?" (heater, fan, drum and filter off now; no bean cooling · dump the beans yourself; the roast is saved as stopped; "Keep roasting" or "Stop roast"), the keep-going answer focused, the verb in amber. History marks a roast stopped this way (an `end` event and no drop) with a Stopped badge. Internally the action and event stay `end`. Finish cooling now keeps the plain question ("Finish cooling the beans? · the countdown ends now"), then stops normally: no heater lock and no banner, unlike Emergency stop. The roast is saved up to that moment and counts as finished.
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
