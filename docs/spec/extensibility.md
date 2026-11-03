# Extensibility

New features are added by registering a new implementation, not by editing the core. Each
extension point is a small interface plus a registry the app fills at startup.

| Extension point    | Interface              | v1 implementations                                    | Later, no core changes                                       |
| ------------------ | ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| Roaster hardware   | `RoasterDriver`        | Skywalker (TC4), Simulator                            | Other roasters and boards (with their own built-in profiles) |
| Connection         | `Transport`            | Serial                                                | Wi-Fi, Bluetooth                                             |
| Control per output | `OutputController`     | Fixed, Planned + PID trim, Curve follow (PID), Manual | Other control methods                                        |
| End of roast       | `EndRule`              | Development time after FC, BT cap                     | Colour sensor, weight loss                                   |
| Phase markers      | `PhaseMarker`          | Dry end by temperature                                | Other automatic markers                                      |
| Profile suggestion | `SuggestionStrategy`   | Same bean, then similar beans                         | Smarter matching                                             |
| Manual coach       | `CoachRule`            | Target gap, RoR trend, milestones                     | New tips                                                     |
| Chart layers       | `ChartLayer`           | Temp, Target, RoR, Ghost, Events                      | Extra probes, annotations                                    |
| Import / export    | `Exporter`, `Importer` | CSV export, Artisan `.alog` import                    | Artisan export, JSON                                         |
| Sync               | `SyncTarget`           | None (local only)                                     | Cloud Postgres for the phone                                 |
| Alerts             | `Notifier`             | Banner + sound                                        | Phone push                                                   |
| Log output         | `LogSink`              | Daily file, dev terminal, live viewer                 | Remote crash reporting                                       |

## Generic data, not fixed fields

- **Channels:** a driver declares what it reads (e.g. `bt` in °C) and what it controls (e.g. `heater` 0–100, step 5). Sensor cards and output controls are built from that list, so a roaster with two probes or no fan just works.
- **Samples:** each sample stores a map of channel values, so a new sensor needs no schema change.
- **Domain events:** one event bus (`ReadingReceived`, `PhaseChanged`, `RoastSaved`, `SafetyTripped`, …). Features subscribe; the core never calls them directly.
- **Versioned formats:** profiles and exports carry a `schemaVersion`; database changes go through Drizzle migrations.
- **Units and language:** stored in °C, grams and seconds; °F, ounces and translations are display settings.

## Where to stop

An extension point exists only where a second implementation is planned or likely. Everything
ships built in for v1: no third-party plugin loading. That keeps the app simple while every
likely change stays a one-class addition.
