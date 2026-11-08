# packages/storage

SQLite persistence: Drizzle schema, migrations and repositories, on Node's built-in `node:sqlite` (ADR 0010).

May import: `core`, `shared`.

## Rules

- Schema changes only through Drizzle migrations (`add-migration` skill). Never edit a released migration.
- Expose repositories that return `core` types; no SQL outside this package.
- Roast samples store a JSON map of channel values, so new sensors need no schema change.
