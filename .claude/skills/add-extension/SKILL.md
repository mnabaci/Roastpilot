---
name: add-extension
description: Add a new implementation of a Roastpilot extension point (roaster driver, transport, end rule, coach rule, chart layer, exporter, notifier, ...). Use when supporting new hardware or a new rule.
---

# Add an extension

Extension points are listed in `docs/spec/extensibility.md`. Each is an interface in `packages/core` plus a registry.

1. Find the interface in `packages/core` and read an existing implementation.
2. Put the new implementation where its dependencies allow:
   - pure logic (end rules, coach rules, suggestion strategies, phase markers) → `packages/core`
   - hardware drivers and transports → `packages/drivers`
   - exporters/importers that touch files → `apps/desktop/src/main` (or `storage` for DB-backed ones)
   - chart layers → `packages/ui`
3. One class or function per file, named for what it does (`DevTimeEndRule`, `Tc4SkywalkerDriver`).
4. Register it in the composition root (`apps/desktop/src/main`), never with a switch inside core.
5. Tests: behaviour against the interface contract; drivers also against `SimulatedDriver` scenarios.
6. Update the table in `docs/spec/extensibility.md`.

## Drivers specifically

- Implement `RoasterDriver`: `channels`, `connect`, `read`, `setOutput(channel, value)`, `safeStop`, `disconnect`.
- Declare channels (id, unit, range, step, read/control) so the UI adapts; never hard-code UI for a roaster.
- Parse and validate every incoming line; reject garbage without throwing in the read loop.
- `safeStop()` must work with a half-broken connection; test it.
- Keep the watchdog alive (Skywalker: a command at least every few seconds).
- Add a roaster record default in `docs/spec/roasters.md`.

## Roaster models specifically

- A model is one `RoasterModelDefinition` file in `packages/drivers/src/models/` (facts, channels, built-in profiles, tuning, batch, `createDriver`), exported from `packages/drivers/src/index.ts`, ADR 0024.
- Add its id and facts (label, limits, drum kind, connection kind) to `ROASTER_MODEL_FACTS` in `packages/shared/src/roaster.ts`: the one hand-edited list of model ids.
- Register it in `apps/desktop/src/main/roaster-models.ts`; tsc fails until every id has a definition.
- No migration: the model column is plain text.
