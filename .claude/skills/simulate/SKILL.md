---
name: simulate
description: Run scripted Roastpilot roasts on the simulated driver to test control and safety. Use after changing the controller, PID, rules or safety.
---

# Simulate roasts

Scenarios live as Vitest tests next to the controller, using `SimulatedDriver` and a fake clock.

1. Pick or add scenarios: cold start, back-to-back (hot start), outdoor (extra heat loss), lost connection mid-roast, sensor stall, over-temperature, manual override then resume.
2. Run them fast with fake time; assert on outcomes: time RoR spent outside each phase's band, soak heat exactly 0%, phase triggers fired in order, drop reached, safety trips, events emitted.
3. For tuning, print a compact table (time, target, temp, heater, fan) every 30 s rather than dumping every sample.
4. A regression in RoR-band error or a missed safety trip fails the test.
