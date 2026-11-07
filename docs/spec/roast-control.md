# Roast profiles and control loop

A profile is a list of phases. Each phase sets heat and fan, says how heat is controlled, and
says when the next phase starts. Two styles come out of the same format:

- **Step profiles** aim each step at a temperature in a duration, inside a RoR range, starting from a heater estimate and a planned fan (the Skywalker Light).
- **Curve profiles** let the PID set heat freely to follow a target BT curve.

Both can start with a fixed soak. The controller runs once per second.

## Profiles belong to a roaster

A profile only makes sense on the roaster it was written for: temperatures come from that
roaster's sensor, and heat percentages from its heater. So every profile has a `roaster_id`.

- Each roaster model ships its own built-in Light / Medium / Dark set. A new roaster without a model-specific set gets generic templates marked "needs calibration".
- Profiles are never shared between roasters automatically. "Copy to another roaster" makes a custom copy marked "needs calibration".
- Model-specific techniques stay in that model's profiles. Example: the Skywalker scorches beans on a hot drum, so its profiles start with a heat-off soak; another roaster's profiles may not.

## Profile format

| Field            | Meaning                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Batch size (g)   | The batch the profile was written for (Skywalker Light: 385 g)                           |
| Charge temp (°C) | BT to charge at, reached and held by the preheat routine                                 |
| Phases           | Ordered list, see below                                                                  |
| End rule         | Drop at development time after first crack, with a BT cap                                |
| Curve points     | `(time, BT)` points: the dashed target on the chart, and the setpoint in `follow` phases |
| Dry-end temp     | BT where Drying becomes Maillard (marker on the chart)                                   |

Each phase:

| Field                  | Meaning                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Name                   | Shown as the phase label                                                                                  |
| Heat mode              | `fixed` (exactly this %), `target` (reach a temperature in a duration) or `follow` (PID tracks the curve) |
| Heat %                 | Exact duty for `fixed`; a starting estimate for `target` and `follow`                                     |
| End temp, duration     | `target`: the temperature this step aims for, and how long it should take                                 |
| Fan %                  | Fan duty                                                                                                  |
| RoR range (°C/min)     | `target`: the limits on the RoR it aims for; empty otherwise                                              |
| Starts next phase when | BT reaches a value, a time passes, or an event (first-crack tap); always with a backup time               |

## Built-in Skywalker profiles

**Light** is the user's own step profile ("Soak" technique). Temperatures are from this modded Skywalker's sensor. Written for 385 g; the default batch is 375 g:

| Phase       | Ends at | Duration | RoR range | Heat estimate | Fan | Next phase when          |
| ----------- | ------- | -------- | --------- | ------------- | --- | ------------------------ |
| Soak        | –       | –        | –         | 0%, fixed     | 30% | 1:00 (Soak time setting) |
| Heat on     | 150 °C  | 4:05     | 14–18     | 85%           | 30% | BT 150 °C (backup 6:30)  |
| Yellowing   | 165 °C  | 1:14     | 12–14     | 65%           | 50% | BT 165 °C (backup 8:00)  |
| Maillard    | 180 °C  | 1:38     | 8–10      | 50%           | 65% | BT 180 °C (backup 11:00) |
| Development | 191 °C  | 1:34     | 3–7       | 40%           | 80% | End rule                 |

- Charge temp 180 °C. Dry end at BT 150 °C. Drop at 1:30 after first crack, or at BT 200 °C, whichever comes first.
- Curve points, from roast 7 (2026-11-04): 0:00 180 °C, 1:04 92 °C (turning point), 2:34 110 °C, 5:05 150 °C, 6:19 165 °C, 7:57 180 °C, 9:18 190 °C, 11:03 197 °C.
- Drum at 100% throughout to agitate the beans.
- A step profile's dashed curve comes from its steps: charge, the turning point, each step's end at its planned time, then the BT cap at the planned drop.
- These numbers come from roasts 6 and 7 and stay marked "needs calibration" until tuned on real roasts: first crack came at 191–193 °C and both roasts dropped near 197 °C.
- The soak runs for the Soak time setting, in Settings under Auto: 0:30, 0:45, 1:00, 1:15, 1:30 or 2:00 (default 1:00). It applies to both Light profiles and is taken at Start. Roasts 6 and 7 turned the heater on at about 1:06 and 0:54.

**Medium** and **Dark** use the same structure with lower heat step-downs and longer development. Their numbers are placeholders until calibrated:

| Profile | Heat steps             | Development after FC | BT cap |
| ------- | ---------------------- | -------------------- | ------ |
| Medium  | 0 → 85 → 70 → 55 → 45% | ~1:45                | 205 °C |
| Dark    | 0 → 85 → 70 → 60 → 50% | ~2:15                | 215 °C |

## Heat control

| Mode     | What the app does                                                | Used for       |
| -------- | ---------------------------------------------------------------- | -------------- |
| `fixed`  | Exactly the planned %, no correction                             | The soak       |
| `target` | Estimate plus up to ±20% PID correction, to reach the step's end | Step profiles  |
| `follow` | PID sets heat 0–100% to track the curve                          | Curve profiles |

- **Fixed phases** send exactly the planned heat. Used for the soak, where any heat would scorch.
- **Target phases** aim for the step's end temperature in its duration, starting from the heater estimate:
  1. RoR is computed over the last 30 s from smoothed BT.
  2. The RoR to aim for is worked out again every second: the temperature still to gain ÷ the time left in the step, kept inside the RoR range. With no time left and BT still short, it is the top of the range; at or past the end temperature, the bottom. A phase's correction stays 0 until RoR has first reached its range, so the climb out of the turning point doesn't pin the correction at its limit.
  3. The PID adds or removes heat to hold that RoR, limited to ±20% of the estimate (per-roaster setting).
  4. Temperature ends the step, not the duration: a step that runs long hands over to the next one where the roast really is, so one late step doesn't leave the rest chasing a clock. The backup time still moves on if the temperature never comes.
  5. Output is clamped to 0–100 and rounded to the roaster's step (Skywalker: 5%); commands are sent only on change.
  6. Anti-windup: the integral stops while the correction is at its limit.
- **Follow phases** run a full PID on BT error against the curve (target = curve value at elapsed time, smoothed BT, anti-windup, roaster step rounding). Past the last curve point the target carries on along the last section's slope, until the end rule drops. They need well-tuned gains per roaster (`pid-tune` skill).
- The fan follows the plan and is never driven by the PID, so heat and fan don't fight. The stall guard is the one exception.

### Stall guard

A roast that loses its RoR before first crack stalls: in roast 6 (2026-11-04) the fan reached 100% and RoR sat near 2.5 °C/min for the last minute before first crack, where roast 7 reached it at 6.3. In Auto, Steps and Curve alike, from the end of the soak until your first-crack tap:

- **Armed** once RoR has first reached 5 °C/min, so the climb out of the turning point never trips it.
- **Trips** when RoR is below 5 °C/min, or will reach it within 60 s at its rate of fall over the last 60 s. **Clears** at 6 °C/min or more with no such fall in sight.
- **Fan:** planned increases wait, then the fan steps down 5% every 30 s, to at most 20% below where it was when the guard tripped. After it clears, it steps back up 5% every 30 s to the plan.
- **Heater:** in `target` phases the correction may go up to +30% instead of +20%. `follow` phases are already free.
- **On screen:** the flow panel says "RoR low · fan held", and each trip and clear is logged and saved as an event.
- An output you set by hand stays yours. The temperature safety limits apply as ever. After your first-crack tap there is no guard: a low RoR is normal there (roast 7 fell to 2.4).
- 5 °C/min, 60 s, 5%, 20% and +30% are starting values, tuned with the profile on real roasts.

Target and follow both handle room conditions: outdoors or on a heat-soaked roaster, the roast drifts from its aim and the PID corrects it. No weather data is used.

## Creating a curve profile

1. **From the Profiles screen:** duplicate Light · Curve and edit its points in a table.
2. **From a roast you liked:** star it, then "Make curve profile". Its BT curve is simplified to about 10 editable points; its fan changes become the fan steps; an initial soak is kept as a fixed phase.
3. **Milestone builder:** enter charge temp and a few milestones (turnaround, yellowing, first crack, drop: time and BT). The app draws a smooth curve through them.
4. **Drag points** on the chart (milestone 8).
5. **Import from Artisan:** load an `.alog` roast as the curve (an `Importer`), marked "needs calibration" if it came from another roaster.

A curve profile is usually: a fixed soak phase, then one `follow` phase until drop, with the fan on its own schedule.

## Roast phases end to end

1. **Preheat (between-batch protocol), every batch:**
   1. If BT is above charge temp − 10 °C (a hot roaster), cool first: heat 0%, fan 100%, drum on, until BT is 20 °C below charge temp (Skywalker Light: 160 °C).
   2. Climb: fan 30%, heat on, PID brings BT to charge temp smoothly.
   3. Hold at charge temp for 2:30 (per-roaster setting, 2–3 min), then show "Add beans". The PID keeps holding until you press Start, for at most 10 min after "Add beans".
   4. Heater off before charge, so the beans don't scorch on landing: at "Add beans" you press Charge soon. The heater goes to 0, whichever way the phases will control heat, and a per-roaster countdown runs (Skywalker: 5 s), then the flow panel says "Beans in". You charge and press Start, and the heater stays at 0 through the soak. With no Start within 30 s of the countdown ending, the hold resumes and Charge soon is offered again. Start without Charge soon also works, as a heater cut at that moment. A heater you set by hand stays yours.
   5. Limits: the cool step and the climb each give up after 15 min, and when the hold's 10 min run out the heater goes to 0 and Auto hands the outputs to you. Both are logged, so a stuck probe or a forgotten roaster can't keep running.
2. **Charge:** you press Start (beans in). The clock starts at 0 and the first phase begins.
3. **Phases:** the controller runs each phase and moves on when its trigger fires (or its backup time passes). Dry end is marked automatically at the dry-end temp.
4. **First crack:** you press First crack; the app records time and BT and starts the development timer. Only your tap starts the timer: the Development heat and fan step can begin earlier, on its BT trigger, but it never counts as a crack. With no tap, the BT cap ends the roast.
5. **Drop:** at the development time, or when BT reaches the cap. Heater 0%, fan 100%, bean cooler on, prompt "Dump beans"; drum cooling starts too ([manual-mode.md](manual-mode.md)).
6. **Cooling:** the beans cool for the bean cooling time (default 4 min), then the roast is saved; the drum keeps cooling to its target unless the next batch's preheat starts (back-to-back session).

After cooling the summary shows the phase split: drying / Maillard / development as % of roast time.

## Manual override

Touching the heater or fan switches that output to manual; the other output stays automatic.
"Resume auto" hands control back to the current phase. Full manual mode:
[manual-mode.md](manual-mode.md).

## Auto mode: first version (milestone 4)

- **Choosing it:** a setting on the Roast screen, Auto or Manual, Manual by default. It can be changed at any time, also mid-roast.
- **What it drives:** heater and fan, from Preheat until Drop. The flow stays as in [manual-mode.md](manual-mode.md), with the same states, events, bean and drum cooling and saving; Auto presses Drop by itself. You still press Preheat, Start and First crack.
- **Profiles:** two Skywalker Light styles to choose from, shipped as data with the Skywalker driver and marked "needs calibration", and your own copies from the Profiles screen ([ui.md](ui.md)). Making a profile from a roast comes in milestone 6; Medium and Dark in milestone 8, once Light is tuned.
  - **Light · Steps:** the table above: each step aims for its end temperature in its duration, inside its RoR range.
  - **Light · Curve:** the same curve points, end rule, fan steps and fixed soak, with every other phase `follow`: no planned heat, the PID sets the heater 0–100%.
- **PID gains:** cautious starting values kept with the profile's roaster data, tuned on real roasts (`pid-tune`). They live in the roaster record from milestone 5.
- **After a stop:** see [safety.md](safety.md), Auto mode. Auto never turns the heater back on by itself.
- **Saved:** the roast has `mode` `auto` and a copy of its profile; phase changes, dry end and overrides are events ([data-model.md](data-model.md)).
