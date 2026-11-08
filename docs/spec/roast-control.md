# Roast profiles and control loop

A profile is a list of phases. Each phase sets heat and fan, says how heat is controlled, and
says when the next phase starts. Two styles come out of the same format:

- **Step profiles** aim each step at a temperature in a duration, inside a RoR range, starting from a heater estimate and a planned fan (the Skywalker Light).
- **Curve profiles** trace a target BT curve: each phase starts from the heater the source roast used, and the PID trims it to hold the curve's own rate of rise.

Both can start with a fixed soak. The controller runs once per second.

## Profiles belong to a roaster

A profile only makes sense on the roaster it was written for: temperatures come from that
roaster's sensor, and heat percentages from its heater. So every profile has a `roaster_id`.

- Each roaster model ships its own built-in Light / Medium / Dark set. A new roaster without a model-specific set gets generic templates marked "needs calibration".
- Profiles are never shared between roasters automatically. "Copy to another roaster" makes a custom copy marked "needs calibration".
- Model-specific techniques stay in that model's profiles. Example: the Skywalker scorches beans on a hot drum, so its profiles start with a heat-off soak; another roaster's profiles may not.

## Profile format

| Field            | Meaning                                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Batch size (g)   | "Tuned for" in the editor: the batch the profile was tuned for (Skywalker Light: 385 g); the Roast screen starts there without a bean's plan, and notes a batch more than 10 % off ([batch-and-stock.md](batch-and-stock.md)) |
| Charge temp (°C) | BT to charge at, reached and held by the preheat routine                                                                                                                                                                      |
| Phases           | Ordered list, see below                                                                                                                                                                                                       |
| End rule         | Drop at development time after first crack, with a BT cap                                                                                                                                                                     |
| Curve points     | `(time, BT)` points: the dashed target on the chart, and the RoR `follow` phases aim for                                                                                                                                      |
| Dry-end temp     | BT where Drying becomes Maillard (marker on the chart)                                                                                                                                                                        |

Each phase:

| Field                  | Meaning                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Name                   | Shown as the phase label                                                                             |
| Heat mode              | `fixed` (exactly this %), `target` (reach a temperature in a duration) or `follow` (trace the curve) |
| Heat %                 | Exact duty for `fixed`; a starting estimate for `target` and `follow`                                |
| End temp, duration     | `target`: the temperature this step aims for, and how long it should take                            |
| Fan %                  | Fan duty                                                                                             |
| RoR range (°C/min)     | `target`: the limits on the RoR it aims for; empty otherwise                                         |
| Starts next phase when | BT reaches a value, a time passes, or an event (first-crack tap); always with a backup time          |

## Built-in Skywalker profiles

**Light** is the user's own step profile ("Soak" technique). Temperatures are from this modded Skywalker's sensor. Written for 385 g; the default batch is 375 g:

| Phase       | Ends at | Duration | RoR range | Heat estimate | Fan | Next phase when           |
| ----------- | ------- | -------- | --------- | ------------- | --- | ------------------------- |
| Soak        | –       | –        | –         | 0%, fixed     | 30% | 1:00 (the profile's soak) |
| Heat on     | 150 °C  | 4:05     | 14–18     | 85%           | 30% | BT 150 °C (backup 6:30)   |
| Yellowing   | 165 °C  | 1:14     | 12–14     | 65%           | 50% | BT 165 °C (backup 8:00)   |
| Maillard    | 180 °C  | 1:38     | 8–10      | 50%           | 65% | BT 180 °C (backup 11:00)  |
| Development | 191 °C  | 1:34     | 3–7       | 40%           | 80% | End rule                  |

- Charge temp 180 °C. Dry end at BT 150 °C. Drop at 1:45 after first crack (about 15.5 % development; roast 7 dropped at 1:31, 13.8 %), or at BT 200 °C, whichever comes first.
- Curve points, from roast 7 (2026-11-04): 0:00 180 °C, 1:04 92 °C (turning point), 2:34 110 °C, 5:05 150 °C, 6:19 165 °C, 7:57 180 °C, 9:18 190 °C, 11:03 197 °C.
- Drum at 100% throughout to agitate the beans.
- A step profile's dashed curve comes from its steps: charge, the turning point, each step's end at its planned time, then the BT cap at the planned drop.
- Every planned curve, curve or step, is one smooth monotone curve through its points: exact at each point, flat at the turning point, the same on the chart, in "vs plan" and in what Auto aims for.
- These numbers come from roasts 6 and 7 and stay marked "needs calibration" until tuned on real roasts: first crack came at 191–193 °C and both roasts dropped near 197 °C.
- **The soak is part of each profile:** Off, 0:30, 0:45, 1:00, 1:15, 1:30 or 2:00 (both Light profiles: 1:00). Off leaves it out: the first step starts at charge with its own heat. Roasts 6 and 7 turned the heater on at about 1:06 and 0:54.
- **From the old setting:** the soak used to be one setting for every profile (Settings › Auto › Soak time). The first launch of the version that moves it writes a value other than 1:00 into your own profiles that soak, once, then the setting is gone; built-ins stay 1:00 (duplicate one to change it).

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
| `follow` | Estimate plus up to ±20% PID correction, to hold the curve's RoR | Curve profiles |

- **Fixed phases** send exactly the planned heat. Used for the soak, where any heat would scorch.
- **Target phases** aim for the step's end temperature in its duration, starting from the heater estimate:
  1. RoR is computed over the last 30 s from smoothed BT. **Settled BT:** everything Auto acts on (phase triggers, dry end, the BT cap, the PID) uses the middle of the last three readings, so one bad reading can't skip a phase or drop the roast; a real temperature counts about a second later.
  2. The RoR to aim for is worked out again every second: the temperature still to gain ÷ the time left in the step, kept inside the RoR range. With no time left and BT still short, it is the top of the range; at or past the end temperature, the bottom. Until your first-crack tap it is never below the stall guard's 5 °C/min, so the two never pull against each other; after the tap the step's own range applies (Development: 3–7). A phase's correction stays 0 until RoR has first reached its range, so the climb out of the turning point doesn't pin the correction at its limit.
  3. The PID adds or removes heat to hold that RoR, limited to ±20% of the estimate (per-roaster setting).
  4. Temperature ends the step, not the duration: a step that runs long hands over to the next one where the roast really is, so one late step doesn't leave the rest chasing a clock. The backup time still moves on if the temperature never comes.
  5. Output is clamped to 0–100 and rounded to the roaster's step (Skywalker: 5%); commands are sent only on change.
  6. Anti-windup: the integral stops while the correction is at its limit, and never holds more than the limits allow, so heat built up while the stall guard allowed +30% is let go as soon as it clears. One time step counts at most 3 s, so a gap (Auto stopped, readings lost) can't land on the integral all at once after Resume auto.
- **Follow phases** trace the curve the way a step traces its range (ADR 0016): the heater reacts to RoR, which moves within seconds, not to BT, which lags the heater by 30–60 s on a drum.
  1. **Estimate:** each phase starts from its heat %, the heater the source roast used there.
  2. **Aim:** the curve's own RoR 30 s ahead (the smooth curve's slope, so the aim never steps at a point) plus 0.3 °C/min for each °C BT is below the curve (minus when above), kept within 0–30 °C/min. Settled BT, as for steps. Past the last curve point the slope carries on. Until your first-crack tap never below the stall guard's 5 °C/min.
  3. **Correction:** the same RoR PID as steps, with its own gains, limited to ±20% of the estimate (+30% while the stall guard trips) and the same anti-windup. It stays 0 until RoR has first reached 5 °C/min (or the aim, when lower), so the climb out of the turning point doesn't pin it.
  4. **Slew limit:** the heater moves at most 5% per 10 s, up or down, so a correction never kicks RoR. From one curve phase to the next it carries on from where the heater was and slews to the new estimate, as roast 7 stepped down 5% at a time; out of the soak it starts at the estimate at once. After Resume auto it starts from the heater the roaster reports (what you left it at) and slews from there, so handing back never jumps the heater; with no heater reading, at the estimate.
  5. No RoR or BT: the heater holds. Rounded to the roaster's step like every output.
  6. 30 s, 0.3, 5% per 10 s, ±20% and the gains are per-roaster tuning (Skywalker values; [roasters.md](roasters.md)), tuned on real roasts (`pid-tune`).
- The fan follows the plan and is never driven by the PID, so heat and fan don't fight. The stall guard is the one exception.

### Stall guard

A roast that loses its RoR before first crack stalls: in roast 6 (2026-11-04) the fan reached 100% and RoR sat near 2.5 °C/min for the last minute before first crack, where roast 7 reached it at 6.3. In Auto, Steps and Curve alike, from the end of the soak until your first-crack tap:

- **Armed** once RoR has first reached 5 °C/min, so the climb out of the turning point never trips it.
- **Trips** when RoR is below 5 °C/min, or will reach it within 60 s at its rate of fall over the last 60 s. **Clears** at 6 °C/min or more with no such fall in sight.
- **Heat first, fan last:** near first crack the drum fills with smoke, and heat is what drives RoR, so the fan keeps its plan while the heater does the work.
- **Heater:** in `target` and `follow` phases the correction may go up to +30% instead of +20%.
- **Fan, only when heat is spent:** once the heater has been at its limit (the +30%, or 100%) for 30 s and the guard is still tripped, planned increases wait and the fan steps down 5% at once, then every 30 s, to at most 20% below the plan. After it clears, it steps back up 5% every 30 s to the plan.
- **On screen:** the flow panel says "RoR low · more heat", and each trip and clear is logged and saved as an event.
- An output you set by hand stays yours. The temperature safety limits apply as ever. After your first-crack tap there is no guard: a low RoR is normal there (roast 7 fell to 2.4).
- 5 °C/min, 60 s, 30 s, 5%, 20% and +30% are starting values, tuned with the profile on real roasts.

Target and follow both handle room conditions: outdoors or on a heat-soaked roaster, the roast drifts from its aim and the PID corrects it. No weather data is used.

## Creating a curve profile

1. **From the Profiles screen:** duplicate Light · Curve and edit its points in a table.
2. **From a roast you liked:** star it, then "Make curve profile". Its BT curve is simplified to about 10 editable points; its fan changes become the fan steps, and each phase's heat estimate is the heater it averaged there; an initial soak is kept as a fixed phase.
3. **Milestone builder:** enter charge temp and a few milestones; the app draws a smooth curve through them (below).
4. **Drag points** on the chart (milestone 8).
5. **Import from Artisan:** load an `.alog` roast as the curve (an `Importer`), marked "needs calibration" if it came from another roaster.

A curve profile is usually: a fixed soak phase, then one `follow` phase until drop, with the fan on its own schedule.

### Milestone builder (milestone 8)

| Milestone     | Time | Temp | Sets in the profile           |
| ------------- | ---- | ---- | ----------------------------- |
| Charge        | 0:00 | ✓    | Charge temp, first point      |
| Turning point | ✓    | ✓    | The curve's lowest point      |
| Dry end       | ✓    | ✓    | Dry-end temp                  |
| First crack   | ✓    | ✓    | Development time = drop − FC  |
| Drop          | ✓    | ✓    | Last point; BT cap = drop + 3 |
| Your points   | ✓    | ✓    | Optional, any number          |

- **Prefilled** from the roaster's built-in curve profile (Light · Curve on the Skywalker), so you change only what differs.
- **Order:** the five milestones go forward in time; your points can sit anywhere between the turning point and drop. Taken in time order, every point after the turning point is warmer than the one before, and the turning point is cooler than charge. Drop is at most 18:00, so every backup fits under 19:00. Each problem shows next to its cell, one line, and Create waits until there are none. Development time and charge temp keep the profile limits (0:30–10:00, 100–230 °C).
- **The curve:** a smooth curve through every milestone that never overshoots between two of them (monotone cubic), sampled every 30 s plus each milestone, so about 22 points for an 11-minute roast, each editable in the points table afterwards.
- **The rest** comes from the built-in curve profile: batch, the soak, the fan steps and their BT triggers, the heat estimates and its "needs calibration". A phase that would start at or above the new cap is dropped, and the one before it runs to the end. Each trigger's backup is when the new curve reaches it plus 1:00.
- **Saved** as a new profile of your own on the active roaster, named "Milestones", "Milestones 2" and so on, with no source.

## Roast phases end to end

1. **Preheat (between-batch protocol), every batch:**
   1. If BT is above charge temp − 10 °C (a hot roaster), cool first: heat 0%, fan 100%, drum on, until BT is 20 °C below charge temp (Skywalker Light: 160 °C). The flow panel says what it is doing in calm words, never the safety trip's: "Cooling to 160 °C first · then climbs to 180 °C for an even start" (both from the profile, in the unit shown).
   2. Climb: fan 30%, heat on, PID brings BT to charge temp smoothly.
   - No Start during the cool step or the climb (nor while the preheat is starting): the drum is neither at charge temperature nor soaked, so beans charged then roast unevenly. Start is offered from the hold on.
   3. Hold at charge temp, then show "Add beans". Each roaster has two holds, 1:30–3:00 each: "first batch" (Skywalker 2:30) and "next batch" (2:00), as a drum still heat-soaked from the last roast needs less time to settle. At Preheat the app picks "next batch" when a roast on this roaster reached Drop or was stopped within the last 20 min (that moment included; read from the saved roasts, so it holds after a restart), else "first batch"; a stopped preheat doesn't count. The setup card shows it before Start and during the preheat ("Preheat hold", "First batch" under it, 2:30), with a small select to change it for this roast only, 1:30–3:00 in 0:15 steps; it is never saved to the roaster and goes with the preheat. A change mid-hold applies to what is left, counting what it has already held: a shorter one than that ends the hold at once. The flow panel counts the hold down ("Holding · 1:42 left"). Nothing else changes: the PID, the 10-min wait after "Add beans" and the safety paths are as before. The PID keeps holding until you press Start, for at most 10 min after "Add beans".
   4. Heater off before charge, so the beans don't scorch on landing: at "Add beans" you press Charge soon. The heater goes to 0 at once (not on the next reading), whichever way the phases will control heat, and a per-roaster countdown runs (Skywalker: 5 s), then the flow panel says "Beans in". You charge and press Start, and the heater stays at 0 through the soak. With no Start within 30 s of the countdown ending, the hold resumes and Charge soon is offered again. Start without Charge soon also works, as a heater cut at that moment. A heater you set by hand stays yours.
   5. Limits: the cool step and the climb each give up after 15 min, and when the hold's 10 min run out the heater goes to 0 and Auto hands the outputs to you. Both are logged, so a stuck probe or a forgotten roaster can't keep running. The flow panel then says "Preheat ran out · heater off · stop, then Preheat again" and offers no Start: the drum is cooling.
2. **Charge:** you press Start (beans in). The clock starts at 0 and the first phase begins.
3. **Phases:** the controller runs each phase and moves on when its trigger fires (or its backup time passes). Dry end is marked automatically at the dry-end temp. BT comes in hot at charge and falls through these temperatures, so a temperature trigger or dry end counts only once BT has been below it (and dry end never in the soak): a profile without a soak skips no step at charge.
4. **First crack:** you press First crack; the app records time and BT and starts the development timer. Only your tap starts the timer: the Development heat and fan step can begin earlier, on its BT trigger, but it never counts as a crack. With no tap, the BT cap ends the roast.
5. **Drop:** at the development time, or when BT reaches the cap. Heater 0%, fan 100%, bean cooler on, prompt "Dump beans"; drum cooling starts too ([manual-mode.md](manual-mode.md)).
6. **Cooling:** the beans cool for the bean cooling time (default 4 min), then the roast is saved; the drum keeps cooling to its target unless the next batch's preheat starts (back-to-back session).

After cooling the summary shows the phase split: drying / Maillard / development as % of roast time.

## Manual override

Touching the heater or fan switches that output to manual; the other output stays automatic.
"Resume auto" hands control back to the current phase; a curve phase picks up from the heater as you left it and slews to its own value, 5% per 10 s. Full manual mode:
[manual-mode.md](manual-mode.md).

## Auto mode: first version (milestone 4)

- **Choosing it:** a setting on the Roast screen, Auto or Manual, Manual by default. It can be changed at any time, also mid-roast:
  - **Off mid-roast:** heater and fan stay where they are, and Drop is yours. The flow panel says so in one line: "Manual · heater stays 85 % · you drop".
  - **On mid-roast:** Auto replays the readings since charge, quietly, and starts in the phase the roast has reached, timed from when it really began; nothing replays from the soak. The roast is then saved as an Auto roast with its profile.
  - Each switch mid-roast is saved as a `mode` event.
- **When Auto stops:** the flow panel and the roast strip say why, in a few words ("Safety stop", "Roaster disconnected", "Heater locked", "Auto failed", "Preheat ran out"), and what is yours now ("you drop").
- **BT cap and the roaster's limit:** Auto drops at the profile's cap or 5 °C under the roaster's max temperature, whichever is lower, so Drop always comes before a safety stop. A profile's cap is above its charge temperature.
- **Development countdown:** in Development the flow panel counts down: "Step: Development · drops in 0:43 or at 200 °C" ("Step", so a profile step named Development isn't read as the roast's Development phase).
- **What it drives:** heater and fan, from Preheat until Drop. The flow stays as in [manual-mode.md](manual-mode.md), with the same states, events, bean and drum cooling and saving; Auto presses Drop by itself. You still press Preheat, Start and First crack.
- **Profiles:** two Skywalker Light styles to choose from, shipped as data with the Skywalker driver and marked "needs calibration", and your own copies from the Profiles screen ([ui.md](ui.md)). Making a profile from a roast comes in milestone 6; Medium and Dark in milestone 8, once Light is tuned.
  - **Light · Steps:** the table above: each step aims for its end temperature in its duration, inside its RoR range.
  - **Light · Curve:** the same curve points, end rule, fan steps, heat estimates and fixed soak, with every other phase `follow`: it aims for the curve's RoR instead of a step's range.
- **PID gains:** cautious starting values kept with the profile's roaster data, tuned on real roasts (`pid-tune`). They live in the roaster record from milestone 5.
- **After a stop:** see [safety.md](safety.md), Auto mode. Auto never turns the heater back on by itself.
- **Saved:** the roast has `mode` `auto` and a copy of its profile; phase changes, dry end and overrides are events ([data-model.md](data-model.md)).
