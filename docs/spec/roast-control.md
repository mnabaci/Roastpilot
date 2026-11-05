# Roast profiles and control loop

A profile is a list of phases. Each phase sets heat and fan, says how heat is controlled, and
says when the next phase starts. Two styles come out of the same format:

- **Step profiles** run planned heat and fan steps at milestones, like a roast run by hand, with a small PID trim for drift (the Skywalker Light).
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

| Field                  | Meaning                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Name                   | Shown as the phase label                                                                                   |
| Heat mode              | `fixed` (exactly this %), `trim` (this % plus a limited PID correction) or `follow` (PID tracks the curve) |
| Heat %                 | Planned heater duty (`fixed`, `trim`); starting value for `follow`                                         |
| Fan %                  | Fan duty                                                                                                   |
| RoR band (°C/min)      | Target rate of rise for `trim`; empty otherwise                                                            |
| Starts next phase when | BT reaches a value, a time passes, or an event (first-crack tap); always with a backup time                |

## Built-in Skywalker profiles

**Light** is the user's own step profile ("Soak" technique). Temperatures are from this modded Skywalker's sensor. Written for 385 g; the default batch is 375 g:

| Phase       | Heat      | Fan | RoR band | Next phase when          |
| ----------- | --------- | --- | -------- | ------------------------ |
| Soak        | 0%, fixed | 30% | –        | 1:00 (Soak time setting) |
| Heat on     | 85%, trim | 30% | 14–18    | BT 150 °C (backup 6:30)  |
| Yellowing   | 65%, trim | 50% | 12–14    | BT 165 °C (backup 8:00)  |
| Maillard    | 50%, trim | 65% | 8–10     | BT 180 °C (backup 11:00) |
| Development | 40%, trim | 80% | 3–7      | End rule                 |

- Charge temp 180 °C. Dry end at BT 150 °C. Drop at 1:30 after first crack, or at BT 200 °C, whichever comes first.
- Curve points, from roast 7 (2026-11-04): 0:00 180 °C, 1:04 92 °C (turning point), 2:34 110 °C, 5:05 150 °C, 6:19 165 °C, 7:57 180 °C, 9:18 190 °C, 11:03 197 °C.
- Drum at 100% throughout to agitate the beans.
- These numbers come from roasts 6 and 7 and stay marked "needs calibration" until tuned on real roasts: first crack came at 191–193 °C and both roasts dropped near 197 °C.
- The soak runs for the Soak time setting, in Settings under Auto: 0:30, 0:45, 1:00, 1:15, 1:30 or 2:00 (default 1:00). It applies to both Light profiles and is taken at Start. Roasts 6 and 7 turned the heater on at about 1:06 and 0:54.

**Medium** and **Dark** use the same structure with lower heat step-downs and longer development. Their numbers are placeholders until calibrated:

| Profile | Heat steps             | Development after FC | BT cap |
| ------- | ---------------------- | -------------------- | ------ |
| Medium  | 0 → 85 → 70 → 55 → 45% | ~1:45                | 205 °C |
| Dark    | 0 → 85 → 70 → 60 → 50% | ~2:15                | 215 °C |

## Heat control

| Mode     | What the app does                                                  | Used for       |
| -------- | ------------------------------------------------------------------ | -------------- |
| `fixed`  | Exactly the planned %, no correction                               | The soak       |
| `trim`   | Planned % with at most ±10% PID correction to keep RoR in the band | Step profiles  |
| `follow` | PID sets heat 0–100% to track the curve                            | Curve profiles |

- **Fixed phases** send exactly the planned heat. Used for the soak, where any heat would scorch.
- **Trim phases** start from the planned heat and let a PID nudge it to keep RoR inside the phase's band:
  1. RoR is computed over the last 30 s from smoothed BT.
  2. The profile's curve picks the target inside the band: the top of the band when BT is 2 °C or more below the curve at this time, the bottom when 2 °C or more above it, in proportion in between. So between two steps the roast follows the planned rise at a RoR the band allows. A phase's correction stays 0 until RoR has first reached its band, so the climb out of the turning point doesn't pin the trim at its limit.
  3. The PID adds or removes heat to hold that target RoR, limited to ±10% of the planned value (per-roaster setting).
  4. Output is clamped to 0–100 and rounded to the roaster's step (Skywalker: 5%); commands are sent only on change.
  5. Anti-windup: the integral stops while the correction is at its limit.
- **Follow phases** run a full PID on BT error against the curve (target = curve value at elapsed time, smoothed BT, anti-windup, roaster step rounding). Past the last curve point the target carries on along the last section's slope, until the end rule drops. They need well-tuned gains per roaster (`pid-tune` skill).
- The fan follows the plan and is never driven by the PID, so heat and fan don't fight. The stall guard is the one exception.

### Stall guard

A roast that loses its RoR before first crack stalls: in roast 6 (2026-11-04) the fan reached 100% and RoR sat near 2.5 °C/min for the last minute before first crack, where roast 7 reached it at 6.3. In Auto, Steps and Curve alike, from the end of the soak until your first-crack tap:

- **Armed** once RoR has first reached 5 °C/min, so the climb out of the turning point never trips it.
- **Trips** when RoR is below 5 °C/min, or will reach it within 60 s at its rate of fall over the last 60 s. **Clears** at 6 °C/min or more with no such fall in sight.
- **Fan:** planned increases wait, then the fan steps down 5% every 30 s, to at most 20% below where it was when the guard tripped. After it clears, it steps back up 5% every 30 s to the plan.
- **Heater:** in `trim` phases the correction may go up to +20% instead of +10%. `follow` phases are already free.
- **On screen:** the flow panel says "RoR low · fan held", and each trip and clear is logged and saved as an event.
- An output you set by hand stays yours. The temperature safety limits apply as ever. After your first-crack tap there is no guard: a low RoR is normal there (roast 7 fell to 2.4).
- 5 °C/min, 60 s, 5%, 20% and +20% are starting values, tuned with the profile on real roasts.

Trim and follow both handle room conditions: outdoors or on a heat-soaked roaster, RoR drifts out of the band and the trim corrects it. No weather data is used.

## Creating a curve profile

1. **From a roast you liked:** star it, then "Make curve profile". Its BT curve is simplified to about 10 editable points; its fan changes become the fan steps; an initial soak is kept as a fixed phase.
2. **Milestone builder:** enter charge temp and a few milestones (turnaround, yellowing, first crack, drop: time and BT). The app draws a smooth curve through them.
3. **Edit points:** drag curve points on the chart or type them in a table.
4. **Import from Artisan:** load an `.alog` roast as the curve (an `Importer`), marked "needs calibration" if it came from another roaster.

A curve profile is usually: a fixed soak phase, then one `follow` phase until drop, with the fan on its own schedule.

## Roast phases end to end

1. **Preheat (between-batch protocol), every batch:**
   1. If BT is above charge temp − 10 °C (a hot roaster), cool first: heat 0%, fan 100%, drum on, until BT is 20 °C below charge temp (Skywalker Light: 160 °C).
   2. Climb: fan 30%, heat on, PID brings BT to charge temp smoothly.
   3. Hold at charge temp for 2:30 (per-roaster setting, 2–3 min), then show "Add beans". The PID keeps holding until you press Start, for at most 10 min after "Add beans".
   4. Heater off before charge, so the beans don't scorch on landing: at "Add beans" you press Charge soon. The heater goes to 0, whichever way the phases will control heat, and a per-roaster countdown runs (Skywalker: 5 s), then the flow panel says "Beans in". You charge and press Start, and the heater stays at 0 through the soak. With no Start within 30 s of the countdown ending, the hold resumes and Charge soon is offered again. Start without Charge soon also works, as a heater cut at that moment. A heater you set by hand stays yours.
   5. Limits: the cool step gives up after 15 min, and when the hold's 10 min run out the heater goes to 0 and Auto hands the outputs to you. Both are logged, so a stuck probe or a forgotten roaster can't keep running.
2. **Charge:** you press Start (beans in). The clock starts at 0 and the first phase begins.
3. **Phases:** the controller runs each phase and moves on when its trigger fires (or its backup time passes). Dry end is marked automatically at the dry-end temp.
4. **First crack:** you press First crack; the app records time and BT and starts the development timer. Only your tap starts the timer: the Development heat and fan step can begin earlier, on its BT trigger, but it never counts as a crack. With no tap, the BT cap ends the roast.
5. **Drop:** at the development time, or when BT reaches the cap. Heater 0%, fan 100%, cooling on, prompt "Dump beans".
6. **Cooling:** runs for the roaster's cooling time (default 4 min). Then either the next batch's preheat starts (back-to-back session) or everything turns off, and the roast is saved.

After cooling the summary shows the phase split: drying / Maillard / development as % of roast time.

## Manual override

Touching the heater or fan switches that output to manual; the other output stays automatic.
"Resume auto" hands control back to the current phase. Full manual mode:
[manual-mode.md](manual-mode.md).

## Auto mode: first version (milestone 4)

- **Choosing it:** a setting on the Roast screen, Auto or Manual, Manual by default. It can be changed at any time, also mid-roast.
- **What it drives:** heater and fan, from Preheat until Drop. The flow stays as in [manual-mode.md](manual-mode.md), with the same states, events, cooling, roaster cool-down and saving; Auto presses Drop by itself. You still press Preheat, Start and First crack.
- **Profiles:** two Skywalker Light styles to choose from, shipped as data with the Skywalker driver and marked "needs calibration". Medium, Dark and making your own come later, with the Profiles work (milestone 6).
  - **Light · Steps:** the table above: planned heat and fan at each step, with the trim following the curve between steps.
  - **Light · Curve:** the same curve points, end rule, fan steps and fixed soak, with every other phase `follow`: no planned heat, the PID sets the heater 0–100%.
- **PID gains:** cautious starting values kept with the profile's roaster data, tuned on real roasts (`pid-tune`). They move to the roaster record in milestone 5.
- **After a stop:** see [safety.md](safety.md), Auto mode. Auto never turns the heater back on by itself.
- **Saved:** the roast has `mode` `auto` and a copy of its profile; phase changes, dry end and overrides are events ([data-model.md](data-model.md)).
