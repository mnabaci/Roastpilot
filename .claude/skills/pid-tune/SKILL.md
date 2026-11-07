---
name: pid-tune
description: Analyse saved Roastpilot roasts and suggest PID gains per roaster. Use when RoR leaves its band, overshoots or oscillates.
---

# Tune the PID

1. Find recent roasts for the active roaster (SQLite in the app's user-data folder, or CSV exports).
2. For each `target` phase, compute: time RoR spent outside its band, overshoot of the RoR peak, oscillation (sign changes of the trim per minute), time the trim spent at its ±limit.
   For each `follow` phase, the same against its aim (curve RoR ahead plus pull), plus how far BT strays from the curve (`curveFollow` tuning, ADR 0016).
3. Diagnose: steady drift → raise `ki`; overshoot or oscillation → lower `kp` or raise `kd`; trim pinned at its limit → the planned heat % is wrong, adjust the profile phase, not the PID. Curve: BT late at every knee → raise `lookAheadS`; slow to close a gap → raise `pullPerC`; RoR wavy with the heater → lower `slewPctPer10s`.
4. Suggest one change at a time with the expected effect; verify it with the `simulate` skill before the user tries a real roast.
5. Record the chosen gains in the roaster record, never as code constants.
