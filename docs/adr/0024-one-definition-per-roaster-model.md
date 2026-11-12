# 0024: One definition per roaster model

Status: accepted
Date: 2026-11-12

## Context

What a roaster model is was spread over seven files in four packages: the model list and its
limits and drum kind in `shared`, its label again in the renderer, its channels, profiles, tuning
and batch sizes in `drivers`, the model list again in the `storage` schema, and "is this the
Simulator?" worked out by comparing the model with the connection kind in the renderer and in the
roaster service. The driver factory ignored the model altogether: any serial port got the
Skywalker driver. Adding a roaster meant finding all of them, against
[extensibility.md](../spec/extensibility.md).

Two things stop a single file from holding everything. `shared` may import nothing internal, yet
zod checks a record's limits there and the renderer validates the Roasters form with that schema.
And the renderer must not import `drivers`: that would bundle the serial port and the driver
classes into the window.

## Decision

- **One hand-edited list in `shared`:** `ROASTER_MODEL_FACTS`, one entry per model with what is
  needed without a driver: its label, limits, whether its drum has a speed, and which connection
  it uses (`serial` or `simulator`). The model ids (`RoasterModelSchema`, the Drizzle column's enum)
  are its keys, so they can't drift from it.
- **One definition per model in `drivers`:** a `RoasterModelDefinition` (interface in `core`) with
  its facts, channels, built-in profiles, tuning, batch sizes, starting values and
  `createDriver(target, { clock, logger })`. Skywalker and Simulator are one file each.
- **Registered at startup:** the composition root (`apps/desktop/src/main/roaster-models.ts`)
  builds the registry from a map of every model id to its definition, so a missing one is a
  compile error. `get(model)` is total for a known model; `find(id)` returns a typed
  `unknown-model` error for anything else.
- **The driver follows the model:** `createDriver` takes the active roaster and the target, picks
  the definition by the roaster's model, and returns a typed `wrong-connection` error when the
  target is not the kind the model uses.
- **Everyone reads the facts:** labels, limits, drum kind and "is it the Simulator" come from the
  facts or the definition; nothing compares model names any more.

## Consequences

- A new model is one entry in `shared`, one definition file (plus its driver, if it is new
  hardware) and one line in the registry. No migration: the model column is plain text.
- A model's label and limits sit in `shared` rather than next to its driver; a test holds each
  definition's channels to its drum fact.
- Connecting with a target the active roaster's model doesn't use is now refused instead of
  silently building the other driver. The app never asks for that: Connect always uses the active
  roaster's own connection.
