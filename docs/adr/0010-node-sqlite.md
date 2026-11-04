# 0010: Node's built-in SQLite instead of better-sqlite3

Status: accepted
Date: 2026-11-04

Supersedes the driver choice in [0003](0003-sqlite-with-drizzle.md); Drizzle and repositories stay.

## Context

better-sqlite3 is a native module built against one runtime's ABI. `pnpm dev` rebuilds app
dependencies for Electron, after which the same files fail to load in the Node test run, and the
packaged app needs it unpacked from the asar. Electron 45 ships Node 24 with `node:sqlite`
(SQLite 3.53), and the test runner (Node 22.22+/24) has it too.

## Decision

Open the database with `DatabaseSync` from `node:sqlite`. Drizzle stays for the typed schema and
generated migrations (`drizzle-kit generate`), and queries go through Drizzle's `sqlite-proxy`
driver backed by `DatabaseSync`. Everything stays behind the repositories in `packages/storage`.

## Consequences

- No native build for storage: tests, `pnpm dev` and packaging use the same code.
- `node:sqlite` is still marked release candidate in Node 24; the repositories hide it, so moving to
  Drizzle's own `node-sqlite` driver (Drizzle 1.0) or back to better-sqlite3 touches one file.
- Statements run synchronously in main; at one sample a second that is well under a millisecond.
