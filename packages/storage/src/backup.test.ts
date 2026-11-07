import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { backupDatabase, backupName, KEEP_BACKUPS, pruneBackups } from './backup';
import { migrate } from './migrate';

/** The message of a storage-failed result; undefined for anything else. */
const failure = (result: { ok: boolean; error?: { kind: string; message?: string } }) =>
  !result.ok && result.error?.kind === 'storage-failed' ? result.error.message : undefined;

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'roastpilot-backup-'));
  dirs.push(dir);
  return dir;
}

function logged() {
  const entries: LogEntry[] = [];
  return { entries, logger: createLogger({ write: (e) => entries.push(e) }, 'storage') };
}

const NOV_7 = new Date(2026, 10, 7, 9, 30);

/** A file in `dir` with its modification time `ageS` seconds in the past. */
function file(dir: string, name: string, ageS = 0): void {
  const path = join(dir, name);
  writeFileSync(path, 'x');
  const at = new Date(Date.now() - ageS * 1000);
  utimesSync(path, at, at);
}

describe('backupName', () => {
  it('names the version about to migrate and the local date', () => {
    expect(backupName('0.2.0', NOV_7)).toBe('roastpilot-before-0.2.0-2026-11-07.db');
    expect(backupName('1.10.3', new Date(2027, 0, 2))).toBe(
      'roastpilot-before-1.10.3-2027-01-02.db',
    );
  });
});

describe('backupDatabase', () => {
  it('makes the backups folder when it is missing and copies the database into it', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    db.exec(`INSERT INTO roasts (mode, started_at) VALUES ('manual', '2026-11-04T10:00:00.000Z')`);
    const dir = join(tempDir(), 'deep', 'backups');
    const result = backupDatabase(db, { dir, appVersion: '0.2.0', now: NOV_7 });
    expect(result).toEqual({ ok: true, value: join(dir, 'roastpilot-before-0.2.0-2026-11-07.db') });
    const copy = new DatabaseSync(join(dir, 'roastpilot-before-0.2.0-2026-11-07.db'));
    expect(copy.prepare('SELECT mode, started_at FROM roasts').all()).toEqual(
      db.prepare('SELECT mode, started_at FROM roasts').all(),
    );
    copy.close();
  });

  it('a second backup the same day never overwrites or fails: it gets -2, then -3', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    const dir = tempDir();
    const plan = { dir, appVersion: '0.2.0', now: NOV_7 };
    backupDatabase(db, plan);
    expect(backupDatabase(db, plan)).toEqual({
      ok: true,
      value: join(dir, 'roastpilot-before-0.2.0-2026-11-07-2.db'),
    });
    expect(backupDatabase(db, plan)).toEqual({
      ok: true,
      value: join(dir, 'roastpilot-before-0.2.0-2026-11-07-3.db'),
    });
  });

  it('a copy that fails (here: mid-transaction, as on a full disk) is a storage-failed result', () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    db.exec('BEGIN');
    const result = backupDatabase(db, { dir: tempDir(), appVersion: '0.2.0', now: NOV_7 });
    expect(failure(result)).toContain("Couldn't back up");
  });

  it('a backups folder that cannot be made is a storage-failed result', () => {
    const parent = tempDir();
    writeFileSync(join(parent, 'backups'), 'a file, not a folder');
    const db = new DatabaseSync(':memory:');
    const result = backupDatabase(db, {
      dir: join(parent, 'backups'),
      appVersion: '0.2.0',
      now: NOV_7,
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
  });
});

describe('pruneBackups', () => {
  it(`keeps the newest ${String(KEEP_BACKUPS)} backups and leaves other files alone`, () => {
    const dir = tempDir();
    for (let i = 1; i <= 7; i++)
      file(dir, `roastpilot-before-0.${String(i)}.0-2026-11-0${String(i)}.db`, (8 - i) * 60);
    file(dir, 'notes.txt', 3600);
    file(dir, 'roastpilot.db', 3600);
    file(dir, 'my-copy.db', 3600);
    mkdirSync(join(dir, 'roastpilot-before-0.0.1-2020-01-01.db.d'));
    const { entries, logger } = logged();
    pruneBackups(dir, logger);
    expect(readdirSync(dir).sort()).toEqual([
      'my-copy.db',
      'notes.txt',
      'roastpilot-before-0.0.1-2020-01-01.db.d',
      'roastpilot-before-0.3.0-2026-11-03.db',
      'roastpilot-before-0.4.0-2026-11-04.db',
      'roastpilot-before-0.5.0-2026-11-05.db',
      'roastpilot-before-0.6.0-2026-11-06.db',
      'roastpilot-before-0.7.0-2026-11-07.db',
      'roastpilot.db',
    ]);
    expect(entries.filter((e) => e.event === 'storage.backup-pruned')).toHaveLength(2);
  });

  it('with fewer than five backups deletes nothing', () => {
    const dir = tempDir();
    file(dir, 'roastpilot-before-0.2.0-2026-11-07.db');
    file(dir, 'roastpilot-before-0.2.0-2026-11-07-2.db');
    pruneBackups(dir, logged().logger);
    expect(readdirSync(dir)).toHaveLength(2);
  });

  it('a folder it cannot read is logged, not thrown', () => {
    const { entries, logger } = logged();
    expect(() => {
      pruneBackups(join(tempDir(), 'missing'), logger);
    }).not.toThrow();
    expect(entries.map((e) => e.event)).toEqual(['storage.backup-prune-failed']);
  });
});
