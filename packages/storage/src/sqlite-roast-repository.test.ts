import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './open-database';
import { drizzleOn } from './proxy-db';
import { TEST_PROFILE } from './test-profile';
import { SqliteRoastRepository } from './sqlite-roast-repository';

function setup() {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'storage');
  const opened = openDatabase(':memory:', logger);
  if (!opened.ok) throw new Error(opened.error.kind);
  const sqlite = opened.value;
  return { sqlite, entries, repository: new SqliteRoastRepository(drizzleOn(sqlite), logger) };
}

async function created(repository: SqliteRoastRepository, startedAt: string) {
  const result = await repository.create({
    startedAt,
    mode: 'manual',
    profile: null,
    roasterId: null,
    beanId: null,
    batchG: null,
    ghostRoastId: null,
  });
  if (!result.ok) throw new Error('create failed');
  return result.value;
}

describe('SqliteRoastRepository', () => {
  it('saves a roast as it goes and reads it back whole', async () => {
    const { repository } = setup();
    const id = await created(repository, '2026-11-04T10:00:00.000Z');
    await repository.addSamples(id, [
      { tS: -60, values: { bt: 150 } },
      { tS: 0, values: { bt: 180, heater: 60 } },
    ]);
    await repository.addEvent(id, { kind: 'charge', tS: 0, bt: 180 });
    await repository.addEvent(id, { kind: 'drop', tS: 600, bt: null });
    await repository.update(id, { dropTimeS: 600, dropTemp: 205.5 });

    expect(await repository.get(id)).toEqual({
      ok: true,
      value: {
        id,
        mode: 'manual',
        profile: null,
        roasterId: null,
        beanId: null,
        ghostRoastId: null,
        batchG: null,
        roastedG: null,
        rating: null,
        isFavourite: false,
        notes: null,
        profileId: null,
        profileName: null,
        startedAt: '2026-11-04T10:00:00.000Z',
        endedAt: null,
        fcTimeS: null,
        dropTimeS: 600,
        dropTemp: 205.5,
        samples: [
          { tS: -60, values: { bt: 150 } },
          { tS: 0, values: { bt: 180, heater: 60 } },
        ],
        events: [
          { kind: 'charge', tS: 0, bt: 180 },
          { kind: 'drop', tS: 600, bt: null },
        ],
      },
    });
  });

  it('keeps the copy of the profile an Auto roast ran, and what Auto did', async () => {
    const { repository } = setup();
    const made = await repository.create({
      startedAt: '2026-11-04T10:00:00.000Z',
      mode: 'auto',
      profile: TEST_PROFILE,
      roasterId: null,
      beanId: null,
      batchG: null,
      ghostRoastId: null,
    });
    if (!made.ok) throw new Error('create failed');
    await repository.addEvent(made.value, { kind: 'phase', tS: 60, bt: 95, detail: 'Heat on' });
    const read = await repository.get(made.value);
    expect(read).toMatchObject({
      ok: true,
      value: {
        mode: 'auto',
        profile: TEST_PROFILE,
        events: [{ kind: 'phase', tS: 60, bt: 95, detail: 'Heat on' }],
      },
    });
  });

  it('keeps a roast whose profile copy can no longer be read, and logs it', async () => {
    const { repository, sqlite, entries } = setup();
    const id = await created(repository, '2026-11-04T10:00:00.000Z');
    sqlite.exec(`UPDATE roasts SET mode = 'auto', profile = '{"old":true}'`);
    expect(await repository.get(id)).toMatchObject({ ok: true, value: { profile: null } });
    expect(entries.map((e) => e.event)).toContain('storage.profile-unreadable');
  });

  it('saves more samples than fit in one insert', async () => {
    const { repository } = setup();
    const id = await created(repository, '2026-11-04T10:00:00.000Z');
    const samples = Array.from({ length: 1_234 }, (_, i) => ({ tS: i, values: { bt: i } }));
    expect(await repository.addSamples(id, samples)).toEqual({ ok: true, value: undefined });
    const read = await repository.get(id);
    expect(read.ok && read.value.samples).toHaveLength(1_234);
  });

  it('lists roasts newest first', async () => {
    const { repository } = setup();
    const older = await created(repository, '2026-11-01T09:00:00.000Z');
    const newer = await created(repository, '2026-11-04T09:00:00.000Z');
    const list = await repository.list();
    expect(list.ok && list.value.map((r) => r.id)).toEqual([newer, older]);
  });

  it('delete removes the roast with its samples and events', async () => {
    const { repository, sqlite } = setup();
    const id = await created(repository, '2026-11-04T10:00:00.000Z');
    await repository.addSamples(id, [{ tS: 0, values: { bt: 180 } }]);
    await repository.addEvent(id, { kind: 'charge', tS: 0, bt: 180 });
    expect(await repository.delete(id)).toEqual({ ok: true, value: undefined });
    expect(await repository.get(id)).toEqual({ ok: false, error: { kind: 'not-found', id } });
    const count = (table: string) =>
      (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
    expect([count('roast_samples'), count('roast_events')]).toEqual([0, 0]);
  });

  it('get and delete say not-found for an unknown roast', async () => {
    const { repository } = setup();
    expect(await repository.get(42)).toEqual({ ok: false, error: { kind: 'not-found', id: 42 } });
    expect(await repository.delete(42)).toEqual({
      ok: false,
      error: { kind: 'not-found', id: 42 },
    });
  });

  it('skips and logs rows that do not parse, keeping the rest', async () => {
    const { repository, sqlite, entries } = setup();
    const id = await created(repository, '2026-11-04T10:00:00.000Z');
    await repository.addSamples(id, [{ tS: 0, values: { bt: 180 } }]);
    sqlite.prepare("INSERT INTO roast_samples VALUES (?, 1, 'not json')").run(id);
    sqlite.prepare("INSERT INTO roast_events VALUES (?, 2, 'teleport', '{}')").run(id);
    const read = await repository.get(id);
    expect(read.ok && read.value.samples).toEqual([{ tS: 0, values: { bt: 180 } }]);
    expect(read.ok && read.value.events).toEqual([]);
    expect(entries.find((e) => e.event === 'storage.rows-unreadable')?.context).toEqual({
      roastId: id,
      skipped: 2,
    });
  });

  it('a write to a closed database is a storage-failed result, not a throw', async () => {
    const { repository, sqlite } = setup();
    sqlite.close();
    expect(
      await repository.create({
        startedAt: 'x',
        mode: 'manual',
        profile: null,
        roasterId: null,
        beanId: null,
        batchG: null,
        ghostRoastId: null,
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'storage-failed' },
    });
    expect(await repository.list()).toMatchObject({ ok: false });
  });
});
