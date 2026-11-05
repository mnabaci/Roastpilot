# 0011: Built-in profile as data, with Auto beside the flow

Status: accepted
Date: 2026-11-05

## Context

Auto mode needs a profile and PID gains now, but the roaster records (milestone 5) and the Profiles work (milestone 6) don't exist yet. The numbers will change after real roasts. The manual flow is already tested on real roasts and handles cooling, saving and reconnects.

## Decision

- The two Skywalker Light profiles (Steps and Curve) and their starting PID gains are typed data shipped with the Skywalker driver, validated with zod and carrying a `schemaVersion`. No `profiles` tables yet. Each roast saves a JSON copy of its profile.
- An `AutoPilot` in `core` runs beside the flow instead of replacing it: it reads readings and roast state, sends heater and fan through the same guarded driver, and asks the flow to Drop. The flow keeps every state, event and cooling rule.
- `fixed`, `trim` and `follow` control all ship now, sharing one PID and one curve lookup. `trim` also uses the curve to pick its target inside the RoR band, a refinement of ADR 0008's fixed band.

## Consequences

Manual roasts keep their code path, and tuning means editing one data file. Moving the data to tables later needs a migration, made simple by the `schemaVersion`. The saved copy keeps old roasts readable after profile changes. `ManualRoast` is no longer an exact name for the flow; rename it when the two have settled.
