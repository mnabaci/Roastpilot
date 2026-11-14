# Extensibility

New features are added by registering a new implementation, not by editing the core. Each
extension point is a small interface plus a registry the app fills at startup.

| Extension point    | Interface                | v1 implementations                                                                       | Later, no core changes                                       |
| ------------------ | ------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Roaster hardware   | `RoasterDriver`          | Skywalker (TC4), Simulator                                                               | Other roasters and boards (with their own built-in profiles) |
| TC4 board dialect  | `Tc4Dialect`             | SkyCommand                                                                               | Other TC4-style sketches (stock TC4 firmware)                |
| Roaster model      | `RoasterModelDefinition` | Skywalker, Simulator                                                                     | Other roaster models                                         |
| Connection         | `Transport`              | Serial                                                                                   | Wi-Fi, Bluetooth                                             |
| Control per output | `OutputController`       | Fixed, Step target (PID), Curve follow (RoR PID), Manual                                 | Other control methods                                        |
| End of roast       | `EndRule`                | Development time after FC, BT cap                                                        | Colour sensor, weight loss                                   |
| Phase markers      | `PhaseMarker`            | Dry end by temperature                                                                   | Other automatic markers                                      |
| Profile suggestion | `SuggestionStrategy`     | Same bean, then similar beans                                                            | Smarter matching                                             |
| Manual coach       | `CoachRule`              | Auto's setting, first crack soon, drop soon                                              | New tips                                                     |
| Chart layers       | `ChartLayer`             | Temp, Target, RoR, Ghost, Events, Heater, Fan; Projection, Now line, Phase bands         | Extra probes, annotations                                    |
| Import / export    | `Exporter`, `Importer`   | Roastpilot files (roasts, beans, profiles, roasters), CSV export, Artisan `.alog` import | Artisan export, a whole-library backup                       |
| Sync               | `SyncTarget`             | None (local only)                                                                        | Cloud Postgres for the phone                                 |
| Alerts             | `Notifier`               | Banner + sound                                                                           | Phone push                                                   |
| Log output         | `LogSink`                | Daily file, dev terminal, live viewer                                                    | Remote crash reporting                                       |

## Roaster models

A roaster model is one `RoasterModelDefinition` in `drivers` ([ADR 0024](../adr/0024-one-definition-per-roaster-model.md)): its channels, built-in profiles, tuning, batch sizes, starting values and `createDriver`. The composition root registers every model at startup, and the driver for a connection is picked by the active roaster's model. What the screens and zod need without a driver (label, limits, drum kind, connection kind) is the model's entry in `ROASTER_MODEL_FACTS` in `shared`, the one hand-edited list of model ids.

A board that speaks Artisan's TC4 text protocol needs no driver class: its model's `createDriver` builds a `Tc4Driver` with its dialect, plain data ([ADR 0026](../adr/0026-one-tc4-driver-with-dialects.md)). Another protocol (binary, Modbus, Wi-Fi) is a driver class of its own, as before.

Adding a model: an entry in `ROASTER_MODEL_FACTS`, a definition file in `packages/drivers/src/models/` exported from the package (and its driver class if it is new hardware), and one line in `apps/desktop/src/main/roaster-models.ts`: four files, no migration.

## Generic data, not fixed fields

- **Channels:** a driver declares what it reads (e.g. `bt` in °C) and what it controls (e.g. `heater` 0–100, step 5). Sensor cards and output controls are built from that list, so a roaster with two probes or no fan just works.
- **Sensor names:** each sensor names itself for the screen, in full and short: the id is the role the app's logic uses (`bt`: the temperature that follows the beans, which the charge point, turning point, RoR, cooling and safety read; later `et`), the names are what the roaster really measures. The Skywalker's probe is the drum where it touches the beans, so its `bt` is "Temperature" / "Temp"; a roaster with bean and environment probes says "Bean temperature" / "BT" and "Environment temperature" / "ET". The Roast screen, chart and roast strip show the connected roaster's names. History shows "Temperature" / "Temp" until saved roasts record which roaster made them.
- **Samples:** each sample stores a map of channel values, so a new sensor needs no schema change.
- **Domain events:** one event bus (`ReadingReceived`, `PhaseChanged`, `RoastSaved`, `SafetyTripped`, …). Features subscribe; the core never calls them directly.
- **Versioned formats:** profiles and exports carry a `schemaVersion`; database changes go through Drizzle migrations.
- **Units and language:** stored in °C, grams and seconds; °F, ounces and translations are display settings.

## Where to stop

An extension point exists only where a second implementation is planned or likely. Everything
ships built in for v1: no third-party plugin loading. That keeps the app simple while every
likely change stays a one-class addition.
