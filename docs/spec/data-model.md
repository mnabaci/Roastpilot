# Data model

One SQLite file in the app's user-data folder, accessed with `node:sqlite` + Drizzle from the
main process (ADR 0010). Seven tables; each milestone adds the tables and columns it writes, in a
new migration. This list matches `packages/storage/src/schema` column for column.

| Table                  | Key columns                                                                                                                                                                             | Notes                                                                                                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `roasters`             | id, name, model, connection, batch_min_g, batch_ideal_g, batch_max_g, max_temp, max_time_s, temp_offset, cooler_helps_drum, drum_speed_pct, wiring, min_fan_heating_pct, pid, is_active | JSON for connection (`ConnectTarget`) and pid (gains, correction limit and both preheat holds: `holdS` first batch, `nextHoldS` next batch; a record from before `nextHoldS` reads 2:00, so no migration). What a model can do is data in code, not a column |
| `profiles`             | id, doc, updated_at, roaster_id                                                                                                                                                         | Your own profiles, one JSON document each, per roaster; built-ins are data in code. Index on roaster_id                                                                                                                                                      |
| `beans`                | id, name, origin, process, species, variety, altitude_m, density_g_l, moisture_pct, screen, decaf, supplier, link, profile_id, green_g, roasted_g, low_stock_g, archived, notes         | Optional fields nullable                                                                                                                                                                                                                                     |
| `bean_stock_movements` | id, bean_id, at, kind, green_g, roasted_g, roast_id, note                                                                                                                               | The bean's stock log: one row per purchase, roast made here, Recount, Take out or batch returned at Clear ([Stock log](#stock-log)). Indexes on (bean_id, at) and roast_id                                                                                   |
| `roasts`               | id, mode, profile, started_at, ended_at, fc_time_s, drop_time_s, drop_temp, roaster_id, bean_id, ghost_roast_id, batch_g, roasted_g, rating, is_favourite, notes, imported              | Profile copied as JSON. Indexes on started_at, bean_id, roaster_id and ghost_roast_id                                                                                                                                                                        |
| `roast_samples`        | roast_id, t_s, values                                                                                                                                                                   | One row per second; values = JSON map of every channel                                                                                                                                                                                                       |
| `roast_events`         | roast_id, t_s, type, detail                                                                                                                                                             | `charge`, `turning-point`, `dry-end`, `first-crack`, `drop`, `cool-end`, `end`, `phase`, `override`, `stall-guard`, `mode`, `coach-applied`                                                                                                                  |

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
| Cool end or Stop roast                          | `ended_at`; the roast is complete                                            |

- With the charge point found earlier than the press (docs/spec/manual-mode.md), `started_at` and every time move with it.
- Saving never asks anything: weights, rating and star arrive with the Beans milestone.
- Ending in Preheat saves nothing; a roast only exists once charged.
- A roast cut short (app quit, crash, cable pulled for good) keeps what was written, with
  `ended_at` empty: History shows it as Unfinished.
- A failed write is logged once per streak and never stops the roast; the roast screen keeps
  working from memory.
- Deleting a roast removes its samples and events (`ON DELETE CASCADE`).
- A roast's summary also carries `fcTemp`, BT at first crack, read from its `first-crack` event,
  and `tpTemp`, BT at its turning point, read from its `turning-point` event (no columns, no
  migration); null without one. Roast files leave them out, as they come from the events.

## Auto mode (milestone 4)

One migration: `roasts.profile`, a JSON copy of the profile the roast ran (with its `schemaVersion`), empty for manual roasts; `mode` is `auto` when Auto was on at charge. New `roast_events` types: `dry-end`, `phase` (detail: its name), `override` (detail: output and value) and `stall-guard` (detail: tripped or cleared). With the coach (milestone 7), without a migration: `coach-applied` (detail: each output changed, with from and to, "heater 65→75, fan 50→40") when you press Apply on the coach card. Later, without a migration: `mode` (detail: auto or manual), when Auto is switched mid-roast; switched on, the roast's `mode` and `profile` are set as if it had charged in Auto.

The same migration adds `profiles` (`id`, `doc`, `updated_at`), your own profiles, each one JSON document checked against the profile format on the way in and out. Built-ins stay data in code ([ADR 0011](../adr/0011-built-in-profile-as-data.md)). A row that no longer parses is skipped and logged.

## Roasters and beans (milestones 5 and 6)

One migration per milestone.

- **Roasters:** `roasters` as in the table above, with Skywalker and Simulator inserted. `profiles.roaster_id` and `roasts.roaster_id` point at it; existing rows get Skywalker. The migration can't read `settings.json`, so the app moves the saved connection into its record on first start. An empty `connection` (Skywalker before a port is picked) is a roaster with no port yet; one that no longer parses is read as none and logged (`storage.roaster-connection-unreadable`).
- **Deleting a profile** (one or several) clears `beans.profile_id` on every bean linked to it, in the same transaction, so no bean points at a profile that isn't there; that bean falls back to the usual profile suggestion. No foreign key or migration: the repository does it.
- **Beans:** `beans` and `bean_purchases` (one row per purchase; since 0011 in the stock log), plus on `roasts`: `bean_id`, `ghost_roast_id`, `batch_g`, `roasted_g`, `rating` (1–5), `is_favourite`, `notes`, empty on older roasts. Which profile a roast ran comes from its JSON copy, so there's no `profile_id`.
- **Stock:** `green_g` and `roasted_g` on the bean are running totals. Start takes the batch off `green_g` as the roast row is made; the roasted weight adds to `roasted_g`, and changing it later adds only the difference. Deleting a roast gives neither back, as those beans are gone, and its row in the stock log stays; Adjust stock › Recount corrects any count. `roasted_g` is still kept but not shown or edited (green only, [batch-and-stock.md](batch-and-stock.md#stock)): no migration, so it could come back.
- **Stock history:** read from the bean's rows in `bean_stock_movements` ([Stock log](#stock-log)). The green stock after each is worked back from today's `green_g`, so it is right now even when older records are missing (stock set before 0010).
- **All or nothing:** every stock write (Start, a roast's weights or bean, Adjust stock) and its stock log row run in one transaction; a failure leaves the database as it was.
- **Deleting a bean:** there's no delete, only Archive, so its roasts keep their name. A deleted roast used as a ghost leaves `ghost_roast_id` empty (`ON DELETE SET NULL`).

## Roastpilot roast files

- **Export** writes a Roastpilot file (`.rpr`, JSON inside, as Artisan's `.alog`, in the shape every Roastpilot file shares: [Beans, profiles and roasters files](#beans-profiles-and-roasters-files)) or a CSV, of every roast ("Export all"), the ones ticked in Select, or the open roast. A Roastpilot file is `{ format: "roastpilot-roasts", version: 2, exportedAt, roasts }` without indentation, each roast in full (its summary, mode, profile copy, samples and events) plus the bean's and roaster's names; ids stay behind, as they mean nothing on another computer. Samples go as columns, `{ tS: […], values: { bt: […], heater: […] } }`, rounded to 0.1, `null` where a sample had no value ([ADR 0015](../adr/0015-compact-roast-files.md)): about 90% smaller than version 1, which still imports.
- **CSV** has one row per roast: `id,started_at,ended_at,bean,profile,batch_g,roasted_g,first_crack_s,drop_s,drop_c,rating,favourite,notes`. Its temperature is in the unit shown ([ui.md](ui.md#units)), and its column says which: `drop_c` as saved, or `drop_f` (°F to 0.1) in °F. Weights and times stay grams and seconds.
- **Import** reads a Roastpilot file (`.rpr`). A roast whose start time is already in History is skipped; the rest are added. A toast says both counts ("Imported 12 roasts · 3 were already here") and History opens the newest roast added, clearing any filter that would hide it. A file that isn't one, or a newer `version`, is refused as a whole with an error toast. Export says "Saved roasts.rpr" in a toast too.
- **Links:** an imported roast links to a bean or roaster with exactly the same name, else to none; it never touches stock, as those beans were roasted elsewhere.
- **Migration 0004:** `roasts.imported` (0 or 1). Existing roasts with no roaster are Artisan imports and get 1. Stock never moves for an imported roast: not at import, not when its weights change, not when its bean changes.
- **Changing a saved roast's bean** (History): for a roast made here, its batch goes back to the old bean's green stock and comes off the new one's, and the roasted weight moves the same way; for an imported roast, only the link changes.

## Beans, profiles and roasters files

Every Roastpilot file follows one shape and one flow, roasts included ([ADR 0021](../adr/0021-one-roastpilot-file-shape.md)):

| Part    | Rule                                                                                                                                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File    | `.rpr`, JSON without indentation: `{ format, version, exportedAt, <items> }`; `format` says the kind, `version` its own version, from 1                                                                                |
| Kinds   | `roastpilot-roasts` (`roasts`, version 2), `roastpilot-beans` (`beans`), `roastpilot-profiles` (`profiles`), `roastpilot-roasters` (`roasters`), version 1 each                                                        |
| Units   | Always °C, grams and seconds, whatever the °F setting: a file reads the same on any computer                                                                                                                           |
| Ids     | Stay behind; links go by name                                                                                                                                                                                          |
| Export  | Each screen's title "⋯": Export all; each item's "⋯": Export this <kind>. Toast: "Saved profiles.rpr"                                                                                                                  |
| Import  | Each screen's title "⋯": Import a Roastpilot file. Toast: "Imported 3 profiles · 1 was already here"; the screen opens the newest one added                                                                            |
| Same    | Something with the same name and the same content is skipped and counted as already here                                                                                                                               |
| Archive | A bean that matches an archived one is skipped too, but counted apart, as you can't see it: "Imported 0 beans · 1 is archived" ("Imported 2 beans · 1 was already here · 1 is archived")                               |
| Clash   | Same name, different content: added as "<name> (imported)", then "(imported 2)"…; nothing of yours is ever overwritten                                                                                                 |
| Refused | A file that isn't one, a newer `version`, or one item that doesn't pass its checks refuses the whole file, with an error toast saying why                                                                              |
| Empty   | A file with no items imports nothing: "Nothing to import · the file is empty" (error toast)                                                                                                                            |
| Size    | A file over 50 MB, roasts included, isn't read: "That file is too big · Roastpilot files are under 50 MB"                                                                                                              |
| Writing | An export goes to `<name>.tmp` beside the file first, then takes its place, so a failed write never leaves half a file; one whose items were all deleted meanwhile saves nothing: "Nothing to export · it was deleted" |
| One     | Imports of one kind run one at a time, from the dialog to the write, so two quick clicks never both add the same thing                                                                                                 |
| Kind    | Another kind is refused by name: "This is a beans file · import it on Beans"                                                                                                                                           |

What each kind carries:

- **Beans:** the bean's fields (name, origin, process, variety, altitude, density, moisture, screen, decaf, supplier, order link, low-stock line, notes) and its profile's name. Not stock or purchases: those are your bags, not the bean's. Its profile links by name among the active roaster's profiles, else none. An imported bean starts with 0 g and is not archived.
- **Profiles:** the profile in full, without its id or roaster. It joins the active roaster's profiles marked "needs calibration", as a copy to another roaster is: it was made on someone else's machine. It passes the same checks as Save, and the active roaster's limits.
- **Roasters:** the record (name, model, batch sizes, limits and calibration, preheat holds, drum speed, bean cooler helps drum, PID gains). Not the port, which belongs to one computer, and never active: an imported Skywalker asks for its port on Connect.
- **What counts as the same:** the content without what an import sets anyway: a bean's profile link and a profile's "needs calibration" don't make it differ, so importing a file twice adds nothing. A copy that came in earlier as "<name> (imported)" counts as already here too. A profile leaves what it was made from (`source`) behind, as that is an id.
- **Export all** on Profiles writes the active roaster's list, built-ins included (they come back as already here); a refusal names the item (cut to 40 characters with "…", "Item 3" when it has no name) and the first problem in the screens' words: `"Light" can't come in · BT cap: At most 235 °C`, or "<field>: not valid" rather than a validator's own words.
- **What is stored** is exported as it is, never checked again: a record saved under looser rules (a roaster above today's model limit) still exports, and still counts when an import compares. Only what comes in is checked.

## Bean and drum cooling

- **Migration 0005:** `roasters.cooler_helps_drum` (0 or 1, default 0); existing Skywalker roasters get 1 ([manual-mode.md](manual-mode.md), Bean cooler helps cool the drum).

## Drum speed

- **Migration 0006:** `roasters.drum_speed_pct` (5–100, default 60), the usual speed of a drum that has one ([roasters.md](roasters.md), Drum speed). Kept on every record; an on/off drum ignores it.
- A roast sample's `drum` is what was sent: 0 or 1 on an on/off drum, the % on a drum with a speed.

## Stock history

- **Migration 0010:** `bean_stock_adjustments` (id, bean_id → beans ON DELETE CASCADE, adjusted_at, green_g, roasted_g, reason `count` | `taken` | `returned`, note). Recount writes a row with what it changed, Take out one with your note (each at the day you picked: `adjusted_at` is that date, `2026-11-07`, when it isn't today, so it sorts like a purchase, before that day's roasts), and Clear's "return to stock" one with the batch it gave back; nothing is backfilled ([batch-and-stock.md](batch-and-stock.md), Stock history).

## Stock log

One table, `bean_stock_movements`, holds everything that moved a bean's stock ([ADR 0023](../adr/0023-one-stock-log.md)):

| Column      | What it holds                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bean_id`   | The bean (→ beans, ON DELETE CASCADE)                                                                                                             |
| `at`        | A day (`2026-11-07`) for a purchase or a change dated another day, else the moment (ISO). Sorted as text, a day comes before its roasts           |
| `kind`      | `bought`, `roasted`, `counted`, `returned` or `taken`. Plain text, no CHECK: checked with zod in the repository, so a new kind needs no migration |
| `green_g`   | What it changed in green grams, signed                                                                                                            |
| `roasted_g` | What it changed in roasted grams, signed; kept on every row although roasted stock isn't shown                                                    |
| `roast_id`  | The roast, for `roasted` (→ roasts, ON DELETE SET NULL)                                                                                           |
| `note`      | Free text: why, for `taken`                                                                                                                       |

- **Adjust stock:** Add writes `bought`; Recount, Take out and Clear's return write `counted`, `taken` and `returned` with what they changed. A change that changes nothing writes no row.
- **A roast made here** (not imported, with a bean): Start writes its `roasted` row (−batch green, 0 roasted, `at` = `started_at`) in the transaction that takes the batch off green. Changing its weights keeps the row in step (−batch, +roasted weight); changing its bean moves the row to the new bean; with no bean, or no weights at all, it has no row. Deleting the roast keeps the row with `roast_id` empty, so the history still adds up: Stock history shows it as "Roasted · roast deleted".
- **An imported roast** never moves stock and has no row.
- A row that doesn't pass its check (an unknown kind) is skipped and logged (`storage.stock-row-unreadable`).

- **Migration 0011:** creates `bean_stock_movements` and copies into it, in this order: every `bean_purchases` row as `bought` (grams, `purchased_at`), every roast made here with a bean and a batch as `roasted` (−`batch_g`, `roasted_g` or 0, `started_at`, its id), and every `bean_stock_adjustments` row (`count` → `counted`, `returned`, `taken`, with its grams, `adjusted_at` and note). Then it drops the two old tables. Same migration, indexes: `bean_stock_movements(bean_id, at)`, `bean_stock_movements(roast_id)`, `roasts(bean_id)`, `roasts(roaster_id)`, `roasts(ghost_roast_id)`, `profiles(roaster_id)`.
- **Migration 0012:** `roasters.wiring` (JSON `Tc4Wiring`, NULL for models without wiring: BT and ET inputs, heater and fan outputs, baud; [roasters.md](roasters.md#generic-tc4)) and `roasters.min_fan_heating_pct` (default 0). Existing roasters get NULL and 0. A generic TC4 whose wiring no longer reads is skipped and logged (`storage.roaster-unreadable`), as wiring decides which output is the heater. ET needs nothing: samples already store a value per channel. A Roastpilot roasters file from before 0012 reads as no wiring and 0.
