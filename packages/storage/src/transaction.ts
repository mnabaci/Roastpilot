import { err, type Result, type StorageError } from '@roastpilot/shared';
import type { DatabaseSync } from 'node:sqlite';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { connectionOf } from './proxy-db';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Rolls back an open transaction; the message when that fails too. */
function rollBack(sqlite: DatabaseSync): string | undefined {
  try {
    // SQLite rolls back by itself on some errors (disk full, I/O); a second ROLLBACK would throw.
    if (sqlite.isTransaction) sqlite.exec('ROLLBACK');
    return undefined;
  } catch (error) {
    return messageOf(error);
  }
}

/**
 * Runs `work` all-or-nothing in one transaction. It commits when `work` returns ok; on an error
 * result or a throw it rolls back, so the database is exactly as before. A throw comes back as a
 * `storage-failed` error; this never throws.
 *
 * `work` must use the `tx` it is given, never `db`: statements on `db` wait for the transaction to
 * end, so they would never run. Other calls on `db` wait meanwhile, so nothing interleaves.
 */
export function transaction<T>(
  db: SqliteRemoteDatabase,
  work: (tx: SqliteRemoteDatabase) => Promise<Result<T, StorageError>>,
): Promise<Result<T, StorageError>> {
  const { sqlite, gate, inside } = connectionOf(db);
  return gate.hold(async (): Promise<Result<T, StorageError>> => {
    try {
      sqlite.exec('BEGIN IMMEDIATE');
      const result = await work(inside);
      if (result.ok) {
        sqlite.exec('COMMIT');
        return result;
      }
      const failed = rollBack(sqlite);
      return failed === undefined ? result : err({ kind: 'storage-failed', message: failed });
    } catch (error) {
      const failed = rollBack(sqlite);
      const message = messageOf(error) + (failed === undefined ? '' : `; rollback: ${failed}`);
      return err({ kind: 'storage-failed', message });
    }
  });
}
