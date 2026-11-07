# Data model

One SQLite file in the app's user-data folder, accessed with `node:sqlite` + Drizzle from the
main process (ADR 0010). Seven tables when complete; each milestone adds the tables and columns it
writes, in a new migration.

| Table            | Key columns                                                                                                                                                                                              | Notes                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `roasters`       | id, name, model, driver, connection, capabilities, batch_min_g, batch_ideal_g, batch_max_g, max_temp, max_time_s, pid, trim_limit_pct, temp_offset, hold_s, cooler_helps_drum, drum_speed_pct, is_active | JSON for connection, capabilities, pid                                                                 |
| `profiles`       | id, doc, updated_at                                                                                                                                                                                      | Your own profiles, one JSON document each; built-ins are data in code                                  |
| `beans`          | id, name, origin, process, variety, altitude_m, density_g_l, moisture_pct, screen, decaf, supplier, profile_id, green_g, roasted_g, low_stock_g, archived, notes                                         | Optional fields nullable                                                                               |
| `bean_purchases` | id, bean_id, purchased_at, grams, batch_plan                                                                                                                                                             | The chosen calculator plan as JSON                                                                     |
| `roasts`         | id, roaster_id, bean_id, ghost_roast_id, mode, batch_g, roasted_g, started_at, ended_at, drop_temp, fc_time_s, rating, is_favourite, notes, imported                                                     | Profile also copied as JSON                                                                            |
| `roast_samples`  | roast_id, t_s, values                                                                                                                                                                                    | One row per second; values = JSON map of every channel                                                 |
| `roast_events`   | roast_id, t_s, type, detail                                                                                                                                                                              | charge, turning_point, dry_end, first_crack, drop, cool_end, end, override, coach_applied, safety_trip |

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

## Roasters and beans (milestones 5 and 6)

One migration per milestone.

- **Roasters:** `roasters` as in the table above, with Skywalker and Simulator inserted. `profiles.roaster_id` and `roasts.roaster_id` point at it; existing rows get Skywalker. The migration can't read `settings.json`, so the app moves the saved connection into its record on first start.
- **Beans:** `beans` and `bean_purchases` as above, plus on `roasts`: `bean_id`, `ghost_roast_id`, `batch_g`, `roasted_g`, `rating` (1–5), `is_favourite`, `notes`, empty on older roasts. Which profile a roast ran comes from its JSON copy, so there's no `profile_id`.
- **Stock:** `green_g` and `roasted_g` on the bean are running totals. Start takes the batch off `green_g` as the roast row is made; the roasted weight adds to `roasted_g`, and changing it later adds only the difference. Deleting a roast gives neither back, as those beans are gone; Adjust stock corrects any count.
- **Deleting a bean:** there's no delete, only Archive, so its roasts keep their name. A deleted roast used as a ghost leaves `ghost_roast_id` empty (`ON DELETE SET NULL`).

## Roastpilot roast files

- **Export** writes a Roastpilot file (`.rpr`, JSON inside, as Artisan's `.alog`) or a CSV, of every roast ("Export all"), the ones ticked in Select, or the open roast. A Roastpilot file is `{ format: "roastpilot-roasts", version: 1, exportedAt, roasts }`, each roast in full (its summary, mode, profile copy, samples and events) plus the bean's and roaster's names; ids stay behind, as they mean nothing on another computer.
- **Import** reads a Roastpilot file (`.rpr`). A roast whose start time is already in History is skipped; the rest are added and the result says both counts ("Imported 12 roasts · 3 were already here"). A file that isn't one, or a newer `version`, is refused as a whole with one line.
- **Links:** an imported roast links to a bean or roaster with exactly the same name, else to none; it never touches stock, as those beans were roasted elsewhere.
- **Migration 0004:** `roasts.imported` (0 or 1). Existing roasts with no roaster are Artisan imports and get 1. Stock never moves for an imported roast: not at import, not when its weights change, not when its bean changes.
- **Changing a saved roast's bean** (History): for a roast made here, its batch goes back to the old bean's green stock and comes off the new one's, and the roasted weight moves the same way; for an imported roast, only the link changes.

## Bean and drum cooling

- **Migration 0005:** `roasters.cooler_helps_drum` (0 or 1, default 0); existing Skywalker roasters get 1 ([manual-mode.md](manual-mode.md), Bean cooler helps cool the drum).

## Drum speed

- **Migration 0006:** `roasters.drum_speed_pct` (5–100, default 60), the usual speed of a drum that has one ([roasters.md](roasters.md), Drum speed). Kept on every record; an on/off drum ignores it.
- A roast sample's `drum` is what was sent: 0 or 1 on an on/off drum, the % on a drum with a speed.
