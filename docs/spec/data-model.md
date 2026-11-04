# Data model

One SQLite file in the app's user-data folder, accessed with `node:sqlite` + Drizzle from the
main process (ADR 0010). Nine tables when complete; each milestone adds the tables and columns it
writes, in a new migration.

| Table            | Key columns                                                                                                                                                                        | Notes                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `roasters`       | id, name, model, driver, connection, capabilities, batch_min_g, batch_ideal_g, batch_max_g, max_temp, max_time_s, pid, trim_limit_pct, temp_offset, hold_s, cool_time_s, is_active | JSON for connection, capabilities, pid                                                  |
| `profiles`       | id, roaster_id, name, is_builtin, needs_calibration, source_roast_id, batch_g, charge_temp, dry_end_temp, dev_time_s, max_bt, created_at                                           | Built-ins read-only, one set per roaster                                                |
| `profile_phases` | profile_id, position, name, heat_mode (`fixed` / `trim` / `follow`), heat_pct, fan_pct, ror_min, ror_max, next_on (`bt` / `time` / `first_crack`), next_value, backup_time_s       | One row per phase, in order                                                             |
| `profile_points` | profile_id, t_s, bt                                                                                                                                                                | Curve points: chart target, and setpoint for `follow` phases                            |
| `beans`          | id, name, origin, process, variety, altitude_m, supplier, green_g, roasted_g, low_stock_g, archived, notes                                                                         | Optional fields nullable                                                                |
| `bean_purchases` | id, bean_id, purchased_at, grams, batch_plan                                                                                                                                       | The chosen calculator plan as JSON                                                      |
| `roasts`         | id, roaster_id, bean_id, profile_id, ghost_roast_id, mode, batch_g, roasted_g, started_at, ended_at, drop_temp, fc_time_s, rating, is_favourite, notes                             | Profile also copied as JSON                                                             |
| `roast_samples`  | roast_id, t_s, values                                                                                                                                                              | One row per second; values = JSON map of every channel                                  |
| `roast_events`   | roast_id, t_s, type, detail                                                                                                                                                        | charge, dry_end, first_crack, drop, cool_end, end, override, coach_applied, safety_trip |

A 12-minute roast is about 720 sample rows, so the file stays small for years.

## Saving a roast (milestone 3)

First migration: `roasts` (id, mode, started_at, ended_at, fc_time_s, drop_time_s, drop_temp),
`roast_samples` and `roast_events`. Times in samples and events are seconds from charge; readings
before charge (preheat) have negative times.

| When                             | Written                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Start (charge)                   | the `roasts` row (`started_at` = wall clock), every reading since Preheat    |
| Every reading                    | one `roast_samples` row                                                      |
| First crack, drop, cool end, end | one `roast_events` row; `fc_time_s`, `drop_time_s`, `drop_temp` on the roast |
| Cool end or End roast            | `ended_at`; the roast is complete                                            |

- Saving never asks anything: weights, rating and star arrive with the Beans milestone.
- Ending in Preheat saves nothing; a roast only exists once charged.
- A roast cut short (app quit, crash, cable pulled for good) keeps what was written, with
  `ended_at` empty: History shows it as Unfinished.
- A failed write is logged once per streak and never stops the roast; the roast screen keeps
  working from memory.
- Deleting a roast removes its samples and events (`ON DELETE CASCADE`).
