# Data model

One SQLite file in the app's user-data folder, accessed with `better-sqlite3` + Drizzle from the
main process. Nine tables:

| Table            | Key columns                                                                                                                                                                        | Notes                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `roasters`       | id, name, model, driver, connection, capabilities, batch_min_g, batch_ideal_g, batch_max_g, max_temp, max_time_s, pid, trim_limit_pct, temp_offset, hold_s, cool_time_s, is_active | JSON for connection, capabilities, pid                                             |
| `profiles`       | id, roaster_id, name, is_builtin, needs_calibration, source_roast_id, batch_g, charge_temp, dry_end_temp, dev_time_s, max_bt, created_at                                           | Built-ins read-only, one set per roaster                                           |
| `profile_phases` | profile_id, position, name, heat_mode (`fixed` / `trim`), heat_pct, fan_pct, ror_min, ror_max, next_on (`bt` / `time` / `first_crack`), next_value, backup_time_s                  | One row per phase, in order                                                        |
| `profile_points` | profile_id, t_s, bt                                                                                                                                                                | Reference points for the chart                                                     |
| `beans`          | id, name, origin, process, variety, altitude_m, supplier, green_g, roasted_g, low_stock_g, archived, notes                                                                         | Optional fields nullable                                                           |
| `bean_purchases` | id, bean_id, purchased_at, grams, batch_plan                                                                                                                                       | The chosen calculator plan as JSON                                                 |
| `roasts`         | id, roaster_id, bean_id, profile_id, ghost_roast_id, mode, batch_g, roasted_g, started_at, ended_at, drop_temp, fc_time_s, rating, is_favourite, notes                             | Profile also copied as JSON                                                        |
| `roast_samples`  | roast_id, t_s, values                                                                                                                                                              | One row per second; values = JSON map of every channel                             |
| `roast_events`   | roast_id, t_s, type, detail                                                                                                                                                        | charge, dry_end, first_crack, drop, cool_end, override, coach_applied, safety_trip |

A 12-minute roast is about 720 sample rows, so the file stays small for years.
