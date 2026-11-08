import { createLogger, ManualClock } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './open-database';
import { drizzleOn } from './proxy-db';
import { SqliteProfileRepository } from './sqlite-profile-repository';
import { TEST_PROFILE as MINE } from './test-profile';

function setup() {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'storage');
  const opened = openDatabase(':memory:', logger);
  if (!opened.ok) throw new Error(opened.error.kind);
  const clock = new ManualClock(0);
  const repository = new SqliteProfileRepository(drizzleOn(opened.value), clock, logger);
  return { sqlite: opened.value, entries, clock, repository };
}

describe('SqliteProfileRepository', () => {
  it('starts empty', async () => {
    expect(await setup().repository.list()).toEqual({ ok: true, value: [] });
  });

  it('saves a profile and reads it back whole', async () => {
    const { repository } = setup();
    expect(await repository.save(MINE, 1)).toEqual({ ok: true, value: undefined });
    expect(await repository.list()).toEqual({ ok: true, value: [{ profile: MINE, roasterId: 1 }] });
  });

  it('saves many at once on one roaster', async () => {
    const { repository } = setup();
    const other = { ...MINE, id: 'custom-2', name: 'Other' };
    expect(await repository.saveAll([MINE, other], 2)).toEqual({ ok: true, value: undefined });
    expect(await repository.list()).toEqual({
      ok: true,
      value: [
        { profile: MINE, roasterId: 2 },
        { profile: other, roasterId: 2 },
      ],
    });
  });

  it('replaces the one with the same id', async () => {
    const { repository } = setup();
    await repository.save(MINE, 1);
    await repository.save({ ...MINE, name: 'Renamed' }, 1);
    expect(await repository.list()).toEqual({
      ok: true,
      value: [{ profile: { ...MINE, name: 'Renamed' }, roasterId: 1 }],
    });
  });

  it('unlinks the beans of a deleted profile in the same write, and no others', async () => {
    const { repository, sqlite } = setup();
    await repository.save(MINE, 1);
    await repository.save({ ...MINE, id: 'custom-2' }, 1);
    sqlite.exec(`INSERT INTO beans (name, origin, process, profile_id) VALUES
      ('Guji', 'Ethiopia', 'washed', '${MINE.id}'), ('Huila', 'Colombia', 'washed', 'custom-2'),
      ('Kenya', 'Kenya', 'washed', '${MINE.id}')`);
    expect(await repository.deleteMany([MINE.id])).toEqual({ ok: true, value: 1 });
    expect(sqlite.prepare('SELECT name, profile_id AS p FROM beans ORDER BY id').all()).toEqual([
      { name: 'Guji', p: null },
      { name: 'Huila', p: 'custom-2' },
      { name: 'Kenya', p: null },
    ]);
  });

  it('deletes several at once and says how many were there to delete', async () => {
    const { repository } = setup();
    await repository.save(MINE, 1);
    await repository.save({ ...MINE, id: 'custom-2' }, 1);
    await repository.save({ ...MINE, id: 'custom-3' }, 1);
    expect(await repository.deleteMany([MINE.id, 'custom-2', 'gone'])).toEqual({
      ok: true,
      value: 2,
    });
    expect(await repository.deleteMany([MINE.id])).toEqual({ ok: true, value: 0 });
    const left = await repository.list();
    expect(left.ok && left.value.map((own) => own.profile.id)).toEqual(['custom-3']);
  });

  it('skips and logs a row it can no longer read, and keeps the rest', async () => {
    const { repository, sqlite, entries } = setup();
    await repository.save(MINE, 1);
    sqlite.exec(
      `INSERT INTO profiles VALUES ('old', '{"old":true}', '2026-01-01T00:00:00.000Z', 1)`,
    );
    expect(await repository.list()).toEqual({ ok: true, value: [{ profile: MINE, roasterId: 1 }] });
    expect(entries.map((e) => e.event)).toContain('storage.profile-unreadable');
  });

  it('turns a broken database into a typed error', async () => {
    const { repository, sqlite } = setup();
    sqlite.close();
    expect(await repository.list()).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
  });
});
