# Data model

One SQLite file in the app's user-data folder, accessed with `node:sqlite` + Drizzle from the
main process (ADR 0010). Seven tables when complete; each milestone adds the tables and columns it
writes, in a new migration.

| Table            | Key columns                                                                                                                                                                        | Notes                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `roasters`       | id, name, model, driver, connection, capabilities, batch_min_g, batch_ideal_g, batch_max_g, max_temp, max_time_s, pid, trim_limit_pct, temp_offset, hold_s, cool_time_s, is_active | JSON for connection, capabilities, pid                                                                 |
| `profiles`       | id, doc, updated_at                                                                                                                                                                | Your own profiles, one JSON document each; built-ins are data in code                                  |
| `beans`          | id, name, origin, process, variety, altitude_m, supplier, green_g, roasted_g, low_stock_g, archived, notes                                                                         | Optional fields nullable                                                                               |
| `bean_purchases` | id, bean_id, purchased_at, grams, batch_plan                                                                                                                                       | The chosen calculator plan as JSON                                                                     |
| `roasts`         | id, roaster_id, bean_id, profile_id, ghost_roast_id, mode, batch_g, roasted_g, started_at, ended_at, drop_temp, fc_time_s, rating, is_favourite, notes                             | Profile also copied as JSON                                                                            |
| `roast_samples`  | roast_id, t_s, values                                                                                                                                                              | One row per second; values = JSON map of every channel                                                 |
| `roast_events`   | roast_id, t_s, type, detail                                                                                                                                                        | charge, turning_point, dry_end, first_crack, drop, cool_end, end, override, coach_applied, safety_trip |

A 12-minute roast is about 720 sample rows, so the file stays small for years.

## Saving a roast (milestone 3)

First migration: `roasts` (id, mode, started_at, ended_at, fc_time_s, drop_time_s, drop_temp),
`roast_samples` and `roast_events`. Times in samples and events are seconds from charge; readings
before charge (preheat) have negative times.

| When                                            | Written                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| Start (charge)                                  | the `roasts` row (`started_at` = wall clock), every reading since Preheat    |
| Every reading                                   | one `roast_samples` row                                                      |
| Turning point, first crack, drop, cool end, end | one `roast_events` row; `fc_time_s`, `drop_time_s`, `drop_temp` on the roast |
| Cool end or End roast                           | `ended_at`; the roast is complete                                            |

- With the charge point found earlier than the press (docs/spec/manual-mode.md), `started_at` and every time move with it.
- Saving never asks anything: weights, rating and star arrive with the Beans milestone.
- Ending in Preheat saves nothing; a roast only exists once charged.
- A roast cut short (app quit, crash, cable pulled for good) keeps what was written, with
  `ended_at` empty: History shows it as Unfinished.
- A failed write is logged once per streak and never stops the roast; the roast screen keeps
  working from memory.
- Deleting a roast removes its samples and events (`ON DELETE CASCADE`).

## Auto mode (milestone 4)

One migration: `roasts.profile`, a JSON copy of the profile the roast ran (with its `schemaVersion`), empty for manual roasts; `mode` is `auto` when Auto was on at charge. New `roast_events` types: `dry-end`, `phase` (detail: its name), `override` (detail: output and value) and `stall-guard` (detail: tripped or cleared).

The same migration adds `profiles` (`id`, `doc`, `updated_at`), your own profiles, each one JSON document checked against the profile format on the way in and out. Built-ins stay data in code ([ADR 0011](../adr/0011-built-in-profile-as-data.md)). A row that no longer parses is skipped and logged.
