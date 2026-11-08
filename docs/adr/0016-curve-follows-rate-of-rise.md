# 0016: Curve phases follow the curve's rate of rise

Status: accepted
Date: 2026-11-07

## Context

`follow` phases ran a PID on BT error against the curve and could set the heater anywhere from 0 to 100%. On a drum roaster BT lags the heater by 30–60 s: by the time BT shows an error the heat that caused it is long in the drum. The PID kept reacting to old news, overshot, and swung the heater in big steps, and RoR flicked and crashed with it. Step profiles don't do this: they start from a heater estimate and trim it by at most ±20% to hold a RoR, which answers within seconds.

## Decision

Curve phases work like steps, with the curve as the plan:

- **Feed-forward:** each phase starts from its heat %, the heater the source roast used there.
- **Aim:** the curve's own RoR, taken 45 s ahead to cover the lag (30 s at first; Auto roast 17 still overshot the dry-end bend), plus 0.3 °C/min per °C BT is behind the curve (less when ahead), kept within 0–30 °C/min and, before the first-crack tap, never under the stall guard's 5.
- **Correction:** a RoR PID (its own gains) limited to ±20% of the estimate, +30% while the stall guard trips, with the usual anti-windup.
- **Slew limit:** the heater moves at most 5% per 10 s either way, also across a change from one curve phase to the next (the new phase starts where the heater was). Only the hand-over from the soak is immediate.
- **Smooth curve:** the curve is a monotone cubic (Fritsch–Butland, as the milestone builder draws) through its points, not straight lines between them, so its RoR is continuous instead of a staircase. Past the last point the last section's slope carries on, which is also the cubic's end slope. The chart's dashed plan and "vs plan" read the same curve, step profiles' planned curves too.
- The new numbers are per-roaster tuning in a `curveFollow` group, with the Skywalker values as defaults. The old temperature-error gains (`follow`) no longer apply and are dropped; a record saved before this reads with the defaults.

## Consequences

- The heater stays near what worked in the source roast and moves smoothly, so RoR has no kicks from the controller. The Roast screen can show the RoR a curve phase aims for, the same number Auto uses.
- A curve can only be traced as well as its estimates: a phase whose heat % is far off is corrected at most ±20% (+30%), and at 5% per 10 s. Bigger misses show as BT drifting from the curve, which the pull term keeps closing.
- Five more numbers per roaster to tune (look-ahead, pull, slew, limit, gains); `pid-tune` covers them. A new roaster model ships its own.
- Curves made earlier drive a little gentler between their points and the same at them: no step in the aim at a point, and no overstated "vs plan" just after a corner.
- Profiles are unchanged: no data migration. Saved gains for the old curve PID are lost, by design.
