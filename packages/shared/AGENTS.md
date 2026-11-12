# packages/shared

Types, the IPC contract with zod schemas, units and constants shared by every package.

May import: nothing internal.

## Rules

- No runtime dependencies on other packages. Only types, schemas, constants and pure helpers.
- The IPC contract lives here: the channel lists (`ipc.ts`), each invoke call's payload and result (`InvokeContract`, `ipc-contract.ts`), each event's payload (`IpcEventPayloads`) and one zod schema per payload. Main and renderer both import it (ADR 0025).
- Units are stored in °C, grams and seconds. `units.ts` holds the pure °C ↔ °F conversions and
  formats; which unit to show is a setting the screens read (`docs/spec/ui.md`, Units).
