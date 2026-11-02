# Roast profiles and control loop

A profile is a target temperature curve plus a fan schedule and end rules. The controller runs
once per second: read temp, compare to the curve, set heater with a PID, set fan from the schedule.

## Profile format

- **Curve:** a list of points `(seconds, °C)`. The target between points is a straight line.
- **Fan schedule:** a list of `(seconds, fan %)` steps, held until the next step.
- **Drop temp:** the temperature that ends the roast.
- **Development time target:** seconds after first crack (optional end rule).
- **Dry-end temp:** where Drying turns into Maillard; adjustable per profile.
- **Preheat temp:** charge temperature before beans go in.
- **PID gains:** `kp`, `ki`, `kd` per profile, with roaster defaults.

Starting values for the built-in profiles are placeholders until calibrated on real roasts:

| Profile | Drop temp (°C) | Dev time after FC | Total time |
| ------- | -------------- | ----------------- | ---------- |
| Light   | ~205           | ~1:30             | ~9–10 min  |
| Medium  | ~212           | ~2:00             | ~10–11 min |
| Dark    | ~222           | ~2:30             | ~11–12 min |

## Heater control (PID)

1. Each second, target = the curve value at elapsed time.
2. Error = target − current temperature (smoothed over the last 3–5 readings).
3. PID output is clamped to 0–100, then rounded to the nearest 5%.
4. Send the heater command only when the value changes.
5. Anti-windup: stop integrating while output is pinned at 0 or 100.

The fan is never driven by the PID. It follows the profile's schedule so heater and fan don't fight.

## Conditions

No weather data and no extra steps. In a colder or windier spot the temperature lags the target,
so the PID adds heater until it catches up; its integral term absorbs a steady extra heat loss
within the first minute or two. Optional later: start each roast with the integral the previous
roast ended with.

## Roast phases

1. **Preheat:** heater on, drum on, fan low until preheat temp is reached; the app says "Add beans".
2. **Charge:** you press Start (beans in). The clock starts at 0 and the curve begins.
3. **Drying and Maillard:** PID follows the curve. At the profile's dry-end temp the app marks Dry end on the chart and the phase label changes from Drying to Maillard. No button.
4. **First crack:** you press First crack. The app records time and temp and starts the development timer.
5. **Drop:** ends when temp ≥ drop temp, or development time is reached, whichever comes first. Heater 0, fan 100, cooling on, prompt "Dump beans".
6. **Cooling:** runs for the roaster's cooling time (default 4 min), then everything off and the roast is saved.

After cooling the summary shows the phase split: drying / Maillard / development as % of roast time.

## Manual override

Touching the heater or fan control switches that output to manual. The other output stays
automatic. "Resume auto" hands control back to the curve. Full manual mode: [manual-mode.md](manual-mode.md).
