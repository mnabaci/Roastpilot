# 0008: Phase-based profiles with PID trim, per roaster

Status: accepted
Date: 2026-11-02

## Context

The real Skywalker light profile is run as heat and fan steps at milestones, starting with a heat-off "soak" because this roaster scorches beans on a hot drum. A pure PID following a BT curve can't guarantee 0% heat for the first minute or reproduce the planned step-downs. Profiles also depend on the roaster's sensor and heater, so they don't transfer between roasters.

## Decision

- A profile is an ordered list of phases: heat mode (`fixed` or `trim`), heat %, fan %, RoR band, and a next-phase trigger (BT, time or first-crack tap) with a backup time.
- In `trim` phases a PID corrects heat by at most ±10% around the plan to keep RoR in the band; `fixed` phases send exactly the planned heat; `follow` phases let the PID track the curve points freely, so curve-following profiles use the same format.
- Every preheat runs the between-batch protocol (cool if hot, climb, hold at charge temp).
- Drop at development time after first crack, capped by a maximum BT.
- Profiles belong to a roaster; each roaster model ships its own built-in set.

Supersedes 0006: room conditions are handled by the trim, still without weather data.

## Consequences

Profiles read like the roaster's own recipe and stay predictable; the trim corrects drift without taking over. The controller needs a small phase engine and per-phase triggers. Profiles must be calibrated per roaster.
