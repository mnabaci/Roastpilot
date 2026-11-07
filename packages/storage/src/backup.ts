import { serializeError, type Logger } from '@roastpilot/core';
import { err, ok, type Result, type StorageError } from '@roastpilot/shared';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

/** Backups kept in the backups folder; older ones are deleted (docs/spec/install-and-update.md). */
export const KEEP_BACKUPS = 5;

/** Where and under what name a backup before migrations goes. */
export interface BackupPlan {
  /** `<userData>/backups`; made if missing. */
  dir: string;
  /** The app version about to migrate the database. */
  appVersion: string;
  now: Date;
}

/** Only files this app wrote: anything else in the folder is never pruned. */
const BACKUP_NAME = /^roastpilot-before-[\w.-]+-\d{4}-\d{2}-\d{2}(-\d+)?\.db$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** `roastpilot-before-0.2.0-2026-11-07.db`: the local date, so it reads as the day you updated. */
export function backupName(appVersion: string, now: Date): string {
  const day = `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `roastpilot-before-${appVersion}-${day}.db`;
}

/** The first free path for `name`: a second backup the same day gets `-2`, then `-3`. */
function freePath(dir: string, name: string): string {
  const stem = name.slice(0, -'.db'.length);
  let path = join(dir, name);
  for (let n = 2; existsSync(path); n++) path = join(dir, `${stem}-${String(n)}.db`);
  return path;
}

/**
 * Copies the database with `VACUUM INTO`: a clean, consistent copy even in WAL mode. Returns the
 * backup's path, or why it couldn't be made (folder, disk full, the copy itself).
 */
export function backupDatabase(db: DatabaseSync, plan: BackupPlan): Result<string, StorageError> {
  try {
    mkdirSync(plan.dir, { recursive: true });
    const path = freePath(plan.dir, backupName(plan.appVersion, plan.now));
    db.prepare('VACUUM INTO ?').run(path);
    return ok(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({ kind: 'storage-failed', message: `Couldn't back up the database: ${message}` });
  }
}

/**
 * Keeps the newest `keep` backups by modification time and deletes the rest. Files that aren't
 * backups are left alone; a file that won't delete is logged and kept.
 */
export function pruneBackups(dir: string, logger: Logger, keep = KEEP_BACKUPS): void {
  let byAge: { path: string; mtimeMs: number }[];
  try {
    byAge = readdirSync(dir)
      .filter((name) => BACKUP_NAME.test(name))
      .map((name) => ({ path: join(dir, name), mtimeMs: statSync(join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs || b.path.localeCompare(a.path));
  } catch (error) {
    logger.warn('storage.backup-prune-failed', { dir, error: serializeError(error) });
    return;
  }
  for (const { path } of byAge.slice(keep)) {
    try {
      rmSync(path);
      logger.info('storage.backup-pruned', { path });
    } catch (error) {
      logger.warn('storage.backup-prune-failed', { path, error: serializeError(error) });
    }
  }
}
