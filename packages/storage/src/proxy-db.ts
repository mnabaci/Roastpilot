import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { WriteGate } from './write-gate';

/** What a transaction needs behind a Drizzle database made by `drizzleOn`. */
export interface Connection {
  sqlite: DatabaseSync;
  gate: WriteGate;
  /** Drizzle on the same connection that skips the gate: for statements inside a transaction. */
  inside: SqliteRemoteDatabase;
}

const connections = new WeakMap<SqliteRemoteDatabase, Connection>();

function execute(db: DatabaseSync, sql: string, params: unknown[], method: string) {
  const statement = db.prepare(sql);
  const values = params as SQLInputValue[];
  if (method === 'run') {
    statement.run(...values);
    return { rows: [] };
  }
  statement.setReturnArrays(true);
  const rows = method === 'get' ? statement.get(...values) : statement.all(...values);
  return { rows: rows as unknown[] };
}

/**
 * Drizzle on Node's built-in SQLite (ADR 0010), through Drizzle's proxy driver: Drizzle builds the
 * SQL, `DatabaseSync` runs it. Rows go back as arrays of column values, as the proxy expects.
 * Statements wait while a transaction (`transaction.ts`) is open on the connection.
 */
export function drizzleOn(sqlite: DatabaseSync): SqliteRemoteDatabase {
  const gate = new WriteGate();
  const db = drizzle((sql, params, method) =>
    gate.enter(() => execute(sqlite, sql, params, method)),
  );
  const inside = drizzle((sql, params, method) =>
    Promise.resolve(execute(sqlite, sql, params, method)),
  );
  connections.set(db, { sqlite, gate, inside });
  return db;
}

/** The connection behind a database made by `drizzleOn`. */
export function connectionOf(db: SqliteRemoteDatabase): Connection {
  const connection = connections.get(db);
  // Programmer error: every repository gets its database from `drizzleOn`.
  if (!connection) throw new Error('This database was not made by drizzleOn.');
  return connection;
}
