---
name: pid-tune
description: Analyse saved Roastpilot roasts and suggest PID gains per roaster. Use when RoR leaves its band, overshoots or oscillates.
---

# Tune the PID

1. Find recent roasts for the active roaster (SQLite in the app's user-data folder, or CSV exports).
2. For each trim phase, compute: time RoR spent outside its band, overshoot of the RoR peak, oscillation (sign changes of the trim per minute), time the trim spent at its ±limit.
3. Diagnose: steady drift → raise `ki`; overshoot or oscillation → lower `kp` or raise `kd`; trim pinned at its limit → the planned heat % is wrong, adjust the profile phase, not the PID.
4. Suggest one change at a time with the expected effect; verify it with the `simulate` skill before the user tries a real roast.
5. Record the chosen gains in the roaster record, never as code constants.
