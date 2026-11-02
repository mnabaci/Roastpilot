# packages/shared

Types, the IPC contract with zod schemas, units and constants shared by every package.

May import: nothing internal.

## Rules

- No runtime dependencies on other packages. Only types, schemas, constants and pure helpers.
- The IPC contract lives here: one channel list, one zod schema per payload. Main and renderer both import it.
- Units are stored in °C, grams and seconds. Display conversion belongs in `ui`.
