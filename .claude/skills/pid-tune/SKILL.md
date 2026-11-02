---
name: pid-tune
description: Analyse saved Roastpilot roasts and suggest PID gains per roaster. Use when the curve overshoots, lags or oscillates.
---

# Tune the PID

1. Find recent roasts for the active roaster (SQLite in the app's user-data folder, or CSV exports).
2. For each, compute: mean and max error vs target, overshoot after the turning point, oscillation (sign changes of error per minute), time heater spent pinned at 0 or 100.
3. Diagnose: steady lag → raise `ki`; overshoot or oscillation → lower `kp` or raise `kd`; pinned output → curve is unreachable, adjust the profile not the PID.
4. Suggest one change at a time with the expected effect; verify it with the `simulate` skill before the user tries a real roast.
5. Record the chosen gains in the roaster record, never as code constants.
