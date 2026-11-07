import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate, schemaVersion } from './migrate';
import { openDatabase } from './open-database';

/** The message of a storage-failed result; undefined for anything else. */
const failure = (result: { ok: boolean; error?: { kind: string; message?: string } }) =>
  !result.ok && result.error?.kind === 'storage-failed' ? result.error.message : undefined;

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const entries: LogEntry[] = [];
  const dir = mkdtempSync(join(tmpdir(), 'roastpilot-db-'));
  dirs.push(dir);
  return { dir, entries, logger: createLogger({ write: (e) => entries.push(e) }, 'storage') };
}

describe('openDatabase', () => {
  it('creates the file, migrates it, and logs the migrations once', () => {
    const { dir, entries, logger } = setup();
    const path = join(dir, 'roastpilot.db');
    const first = openDatabase(path, logger);
    expect(first.ok).toBe(true);
    if (first.ok) first.value.close();
    const again = openDatabase(path, logger);
    if (again.ok) again.value.close();
    expect(entries.filter((e) => e.event === 'storage.migrated')).toHaveLength(1);
  });

  it('a path it cannot open is a logged storage-failed result', () => {
    const { dir, entries, logger } = setup();
    const result = openDatabase(join(dir, 'missing', 'roastpilot.db'), logger);
    expect(result).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
    expect(entries.some((e) => e.event === 'storage.open-failed')).toBe(true);
  });

  describe('backup before migrations', () => {
    const NOV_7 = new Date(2026, 10, 7, 9, 30);
    const BACKUP = 'roastpilot-before-0.2.0-2026-11-07.db';

    /** A database file an older app left: the first three migrations and one roast. */
    function oldDatabase(dir: string): string {
      const path = join(dir, 'roastpilot.db');
      const db = new DatabaseSync(path);
      migrate(db, MIGRATIONS.slice(0, 3));
      db.exec(
        `INSERT INTO roasts (mode, started_at) VALUES ('manual', '2026-11-04T10:00:00.000Z')`,
      );
      db.close();
      return path;
    }

    const planIn = (dir: string) => ({
      dir: join(dir, 'backups'),
      appVersion: '0.2.0',
      now: NOV_7,
    });

    it('copies an older database before migrating it; the copy is the old one, unchanged', () => {
      const { dir, entries, logger } = setup();
      const path = oldDatabase(dir);
      const opened = openDatabase(path, logger, planIn(dir));
      expect(opened.ok).toBe(true);
      if (opened.ok) opened.value.close();
      const copy = new DatabaseSync(join(dir, 'backups', BACKUP));
      expect(schemaVersion(copy)).toBe(3);
      expect(copy.prepare('SELECT mode, started_at FROM roasts').all()).toEqual([
        { mode: 'manual', started_at: '2026-11-04T10:00:00.000Z' },
      ]);
      copy.close();
      expect(entries.map((e) => e.event)).toEqual(['storage.backed-up', 'storage.migrated']);
    });

    it('a new, empty database needs no backup', () => {
      const { dir, logger } = setup();
      const opened = openDatabase(join(dir, 'roastpilot.db'), logger, planIn(dir));
      if (opened.ok) opened.value.close();
      expect(existsSync(join(dir, 'backups'))).toBe(false);
    });

    it('with nothing to migrate, no backup', () => {
      const { dir, logger } = setup();
      const path = join(dir, 'roastpilot.db');
      const first = openDatabase(path, logger);
      if (first.ok) first.value.close();
      const again = openDatabase(path, logger, planIn(dir));
      if (again.ok) again.value.close();
      expect(existsSync(join(dir, 'backups'))).toBe(false);
    });

    it('a failed backup stops the migrations and fails like a database that will not open', () => {
      const { dir, entries, logger } = setup();
      const path = oldDatabase(dir);
      writeFileSync(join(dir, 'backups'), 'a file where the folder should be');
      const opened = openDatabase(path, logger, planIn(dir));
      expect(failure(opened)).toContain("Couldn't back up");
      expect(entries.map((e) => e.event)).toEqual(['storage.backup-failed']);
      const db = new DatabaseSync(path);
      expect(schemaVersion(db)).toBe(3);
      db.close();
    });

    it('a database from a newer app is refused: no backup, no migration', () => {
      const { dir, entries, logger } = setup();
      const path = join(dir, 'roastpilot.db');
      const newer = new DatabaseSync(path);
      newer.exec(`PRAGMA user_version = ${String(MIGRATIONS.length + 1)}`);
      newer.close();
      const opened = openDatabase(path, logger, planIn(dir));
      expect(failure(opened)).toContain('newer Roastpilot');
      expect(existsSync(join(dir, 'backups'))).toBe(false);
      expect(entries.map((e) => e.event)).toEqual(['storage.backup-failed']);
    });

    it('keeps only the last five backups', () => {
      const { dir, logger } = setup();
      for (let day = 1; day <= 7; day++) {
        const path = oldDatabase(mkdtempSync(join(dir, 'run-')));
        const opened = openDatabase(path, logger, {
          dir: join(dir, 'backups'),
          appVersion: '0.2.0',
          now: new Date(2026, 10, day),
        });
        if (opened.ok) opened.value.close();
      }
      expect(readdirSync(join(dir, 'backups'))).toHaveLength(5);
    });
  });
});
