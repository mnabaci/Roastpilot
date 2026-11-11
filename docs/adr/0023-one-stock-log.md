# 0023: One stock log per bean

Status: accepted
Date: 2026-11-11

## Context

A bean's stock history was put together from three places: `bean_purchases`, the roasts made here
(read from `roasts`), and `bean_stock_adjustments`. Deleting a roast took its row out of the
history while its batch stayed off the stock, so "Green after" could not add up and the spec had
to say the oldest steps may be off. Three queries also meant three shapes to keep in step, and a
fourth kind of movement would have meant a fourth table.

## Decision

- One table, `bean_stock_movements`: bean, `at`, `kind`, signed `green_g` and `roasted_g`, the
  roast for `roasted`, and a free-text note. Migration 0011 copies purchases, adjustments and the
  roasts made here into it and drops the two old tables.
- A roast made here writes its own `roasted` row at Start, in the transaction that takes its batch
  off green, and keeps it in step when its weights or bean change. Deleting the roast keeps the row
  with `roast_id` empty (`ON DELETE SET NULL`): Stock history shows "Roasted · roast deleted".
- `kind` is plain text without a CHECK constraint; zod checks it at the repository and IPC, and
  the renderer maps each kind to its label in one place.
- Every row records both green and roasted grams, although roasted stock isn't shown.
- Indexes for the lookups the app makes: the log by bean and day and by roast, and roasts by bean,
  roaster and ghost, profiles by roaster.

## Consequences

- Stock history is one query, sorted by `at` then id, and adds up exactly from the first record.
- The roast's weights live twice (on the roast and in its row); the repository writes both in one
  transaction, and tests hold them in step.
- A deleted roast's grams stay in the log, which is the point, but it can no longer be opened.

## Later

What this lets us add without a migration:

- **Roasted stock back on screen:** every row already carries `roasted_g`, roasted rows with the
  roast's roasted weight, so it is a UI change.
- **New kinds** such as roasted coffee `sold` or `given`, or green going into a `blend`: a new
  value in the kind list and one label.
- **More roasters:** the log is per bean, whichever roaster roasted it.

What would still need one: a movement that points at something other than a roast (a blend's
other bean, an order), a unit other than grams, or stock per place or bag.
