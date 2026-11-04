import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

/**
 * Drizzle on Node's built-in SQLite (ADR 0010), through Drizzle's proxy driver: Drizzle builds the
 * SQL, `DatabaseSync` runs it. Rows go back as arrays of column values, as the proxy expects.
 */
export function drizzleOn(db: DatabaseSync): SqliteRemoteDatabase {
  return drizzle((sql, params, method) => {
    const statement = db.prepare(sql);
    const values = params as SQLInputValue[];
    if (method === 'run') {
      statement.run(...values);
      return Promise.resolve({ rows: [] });
    }
    statement.setReturnArrays(true);
    const rows = method === 'get' ? statement.get(...values) : statement.all(...values);
    return Promise.resolve({ rows: rows as unknown[] });
  });
}
