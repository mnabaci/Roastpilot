import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from './open-database';

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
});
