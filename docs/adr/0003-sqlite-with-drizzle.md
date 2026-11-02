# 0003: Local SQLite with Drizzle

Status: accepted
Date: 2026-11-02

## Context

A single-user desktop app needs no server. Drizzle keeps the schema typed and migrations generated.

## Decision

One SQLite file via better-sqlite3, schema and migrations with Drizzle, accessed only through repositories in `packages/storage`.

## Consequences

Cloud sync for the phone is a later `SyncTarget`, not a database change.
