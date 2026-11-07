import { serializeError, type Logger } from '@roastpilot/core';
import { err, ok, type Result, type StorageError } from '@roastpilot/shared';
import { DatabaseSync } from 'node:sqlite';
import { backupDatabase, pruneBackups, type BackupPlan } from './backup';
import { migrate, pendingMigrations, schemaVersion } from './migrate';

/**
 * Before migrating a database that has data, copies it to the backups folder; a new, empty one
 * needs none. A failed backup stops the migrations (docs/spec/install-and-update.md).
 */
function backupBeforeMigrate(
  db: DatabaseSync,
  plan: BackupPlan | undefined,
  logger: Logger,
): Result<void, StorageError> {
  const pending = pendingMigrations(db);
  if (!pending.ok) return pending;
  if (!plan || pending.value.length === 0 || schemaVersion(db) === 0) return ok(undefined);
  const backup = backupDatabase(db, plan);
  if (!backup.ok) return backup;
  logger.info('storage.backed-up', { path: backup.value, pending: pending.value.length });
  pruneBackups(plan.dir, logger);
  return ok(undefined);
}

/**
 * Opens (or creates) the database at `path` and migrates it, backing it up first when `backup` is
 * given. `:memory:` for tests. WAL keeps writes during a roast cheap and safe if the app dies
 * mid-roast.
 */
export function openDatabase(
  path: string,
  logger: Logger,
  backup?: BackupPlan,
): Result<DatabaseSync, StorageError> {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(path);
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  } catch (error) {
    logger.error('storage.open-failed', { path, error: serializeError(error) });
    return err({
      kind: 'storage-failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const backedUp = backupBeforeMigrate(db, backup, logger);
  if (!backedUp.ok) {
    logger.error('storage.backup-failed', { path, error: backedUp.error });
    db.close();
    return backedUp;
  }
  const migrated = migrate(db);
  if (!migrated.ok) {
    logger.error('storage.migrate-failed', { path, error: migrated.error });
    db.close();
    return migrated;
  }
  if (migrated.value.applied.length > 0)
    logger.info('storage.migrated', { path, applied: migrated.value.applied });
  return ok(db);
}
