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

| Phase       | Heat      | Fan | RoR band                    | Next phase when                    |
| ----------- | --------- | --- | --------------------------- | ---------------------------------- |
| Soak        | 0%, fixed | 30% | –                           | 1:00                               |
| Heat on     | 85%, trim | 30% | 16–18 at peak, then falling | BT 150 °C (backup 5:00)            |
| Yellowing   | 65%, trim | 50% | 12–14                       | BT 165 °C (backup 7:00)            |
| Maillard    | 50%, trim | 65% | 8–10                        | First-crack tap (backup BT 185 °C) |
| Development | 40%, trim | 80% | 5–7 → 3–5                   | End rule                           |

- Charge temp 180 °C. Drop at 1:10 after first crack, or at BT 195 °C, whichever comes first.
- Curve points: 0:00 180 °C, ~2:15 110 °C (turnaround and RoR peak), 4:30 150 °C, 6:30 165 °C, 8:00 182 °C, ~9:20 190 °C.
- Drum at 100% throughout to agitate the beans.

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
  2. Inside the band: no correction (deadband), so the roast runs as planned.
  3. Outside the band: the PID adds or removes heat, limited to ±10% of the planned value (per-roaster setting).
  4. Output is clamped to 0–100 and rounded to the roaster's step (Skywalker: 5%); commands are sent only on change.
  5. Anti-windup: the integral stops while the correction is at its limit.
- **Follow phases** run a full PID on BT error against the curve (target = curve value at elapsed time, smoothed BT, anti-windup, roaster step rounding). They need well-tuned gains per roaster (`pid-tune` skill).
- The fan always follows the plan. It is never driven by the PID, so heat and fan don't fight.

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
   3. Hold at charge temp for 2:30 (per-roaster setting, 2–3 min), then show "Add beans".
2. **Charge:** you press Start (beans in). The clock starts at 0 and the first phase begins.
3. **Phases:** the controller runs each phase and moves on when its trigger fires (or its backup time passes). Dry end is marked automatically at the dry-end temp.
4. **First crack:** you press First crack; the app records time and BT and starts the development timer.
5. **Drop:** at the development time, or when BT reaches the cap. Heater 0%, fan 100%, cooling on, prompt "Dump beans".
6. **Cooling:** runs for the roaster's cooling time (default 4 min). Then either the next batch's preheat starts (back-to-back session) or everything turns off, and the roast is saved.

After cooling the summary shows the phase split: drying / Maillard / development as % of roast time.

## Manual override

Touching the heater or fan switches that output to manual; the other output stays automatic.
"Resume auto" hands control back to the current phase. Full manual mode:
[manual-mode.md](manual-mode.md).
