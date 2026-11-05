import { err, ok, type Result, type StorageError } from '@roastpilot/shared';
import type { DatabaseSync } from 'node:sqlite';
import roasts0000 from './migrations/0000_roasts.sql?raw';
import profiles0001 from './migrations/0001_profiles.sql?raw';

/**
 * Every migration drizzle-kit generated, in order (src/migrations/meta/_journal.json). Add the new
 * file here after `drizzle-kit generate`; a test checks this list against the journal.
 */
export const MIGRATIONS: readonly { tag: string; sql: string }[] = [
  { tag: '0000_roasts', sql: roasts0000 },
  { tag: '0001_profiles', sql: profiles0001 },
];

function userVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  return row?.user_version ?? 0;
}

/**
 * Brings the database up to date. `PRAGMA user_version` counts the migrations applied; each one
 * runs in its own transaction, so a failure leaves the database as it was before that migration.
 */
export function migrate(
  db: DatabaseSync,
  migrations: readonly { tag: string; sql: string }[] = MIGRATIONS,
): Result<{ applied: string[] }, StorageError> {
  const version = userVersion(db);
  if (version > migrations.length)
    return err({
      kind: 'storage-failed',
      message: `The database is from a newer Roastpilot (schema ${String(version)}).`,
    });
  const applied: string[] = [];
  for (const [index, migration] of migrations.entries()) {
    if (index < version) continue;
    try {
      db.exec('BEGIN');
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${String(index + 1)}`);
      db.exec('COMMIT');
      applied.push(migration.tag);
    } catch (error) {
      db.exec('ROLLBACK');
      const message = error instanceof Error ? error.message : String(error);
      return err({ kind: 'storage-failed', message: `Migration ${migration.tag}: ${message}` });
    }
  }
  return ok({ applied });
}
