import { serializeError, type Logger } from '@roastpilot/core';
import { err, ok, type Result, type StorageError } from '@roastpilot/shared';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from './migrate';

/**
 * Opens (or creates) the database at `path` and migrates it. `:memory:` for tests.
 * WAL keeps writes during a roast cheap and safe if the app dies mid-roast.
 */
export function openDatabase(path: string, logger: Logger): Result<DatabaseSync, StorageError> {
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
