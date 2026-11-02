---
name: add-migration
description: Change the Roastpilot SQLite schema safely with Drizzle. Use whenever a table or column changes.
---

# Add a migration

1. Update `docs/spec/data-model.md` first.
2. Edit the Drizzle schema in `packages/storage/src/schema`.
3. Generate the migration: `pnpm --filter @roastpilot/storage exec drizzle-kit generate`. Read the SQL it wrote.
4. Never edit a migration that has shipped; add a new one instead.
5. Data changes (backfills, splitting a column) go in the same migration, written to be safe on an existing database.
6. Update the repositories and their return types; nothing outside `storage` sees SQL or rows.
7. Test: run migrations on an empty in-memory DB and on one seeded with the previous schema.
