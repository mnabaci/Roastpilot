import { err, ok, type Result, type StorageError } from '@roastpilot/shared';
import type { DatabaseSync } from 'node:sqlite';
import roasts0000 from './migrations/0000_roasts.sql?raw';
import profiles0001 from './migrations/0001_profiles.sql?raw';
import roasters0002 from './migrations/0002_roasters.sql?raw';
import beans0003 from './migrations/0003_beans.sql?raw';
import roastImported0004 from './migrations/0004_roast_imported.sql?raw';
import coolerHelpsDrum0005 from './migrations/0005_cooler_helps_drum.sql?raw';
import drumSpeed0006 from './migrations/0006_drum_speed.sql?raw';
import beanLink0007 from './migrations/0007_bean_link.sql?raw';
import beanSpecies0008 from './migrations/0008_bean_species.sql?raw';
import dropPurchaseBatchPlan0009 from './migrations/0009_drop_purchase_batch_plan.sql?raw';
import beanStockAdjustments0010 from './migrations/0010_bean_stock_adjustments.sql?raw';

interface Migration {
  tag: string;
  sql: string;
}

/**
 * Every migration drizzle-kit generated, in order (src/migrations/meta/_journal.json). Add the new
 * file here after `drizzle-kit generate`; a test checks this list against the journal.
 */
export const MIGRATIONS: readonly Migration[] = [
  { tag: '0000_roasts', sql: roasts0000 },
  { tag: '0001_profiles', sql: profiles0001 },
  { tag: '0002_roasters', sql: roasters0002 },
  { tag: '0003_beans', sql: beans0003 },
  { tag: '0004_roast_imported', sql: roastImported0004 },
  { tag: '0005_cooler_helps_drum', sql: coolerHelpsDrum0005 },
  { tag: '0006_drum_speed', sql: drumSpeed0006 },
  { tag: '0007_bean_link', sql: beanLink0007 },
  { tag: '0008_bean_species', sql: beanSpecies0008 },
  { tag: '0009_drop_purchase_batch_plan', sql: dropPurchaseBatchPlan0009 },
  { tag: '0010_bean_stock_adjustments', sql: beanStockAdjustments0010 },
];

/** How many migrations the database has had (`PRAGMA user_version`); 0 for a new one. */
export function schemaVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  return row?.user_version ?? 0;
}

/**
 * The migrations `migrate` would run, without running them. A database from a newer Roastpilot is
 * an error: this app can't read it and leaves it alone.
 */
export function pendingMigrations(
  db: DatabaseSync,
  migrations: readonly Migration[] = MIGRATIONS,
): Result<Migration[], StorageError> {
  const version = schemaVersion(db);
  if (version > migrations.length)
    return err({
      kind: 'storage-failed',
      message: `The database is from a newer Roastpilot (schema ${String(version)}).`,
    });
  return ok(migrations.slice(version));
}

/**
 * Brings the database up to date. `PRAGMA user_version` counts the migrations applied; each one
 * runs in its own transaction, so a failure leaves the database as it was before that migration.
 */
export function migrate(
  db: DatabaseSync,
  migrations: readonly Migration[] = MIGRATIONS,
): Result<{ applied: string[] }, StorageError> {
  const pending = pendingMigrations(db, migrations);
  if (!pending.ok) return pending;
  const version = schemaVersion(db);
  const applied: string[] = [];
  for (const [offset, migration] of pending.value.entries()) {
    try {
      db.exec('BEGIN');
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${String(version + offset + 1)}`);
      db.exec('COMMIT');
      applied.push(migration.tag);
    } catch (error) {
      // SQLite rolls back by itself on some errors (disk full, I/O); a second ROLLBACK would throw.
      if (db.isTransaction) db.exec('ROLLBACK');
      const message = error instanceof Error ? error.message : String(error);
      return err({ kind: 'storage-failed', message: `Migration ${migration.tag}: ${message}` });
    }
  }
  return ok({ applied });
}
