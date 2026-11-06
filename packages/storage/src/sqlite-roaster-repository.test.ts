import { createLogger } from '@roastpilot/core';
import type { LogEntry, Roaster } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './open-database';
import { drizzleOn } from './proxy-db';
import { SqliteRoastRepository } from './sqlite-roast-repository';
import { SqliteRoasterRepository } from './sqlite-roaster-repository';

function setup() {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'storage');
  const opened = openDatabase(':memory:', logger);
  if (!opened.ok) throw new Error(opened.error.kind);
  const db = drizzleOn(opened.value);
  return {
    sqlite: opened.value,
    entries,
    repository: new SqliteRoasterRepository(db, logger),
    roasts: new SqliteRoastRepository(db, logger),
  };
}

async function listed(repository: SqliteRoasterRepository): Promise<Roaster[]> {
  const read = await repository.list();
  if (!read.ok) throw new Error('list failed');
  return read.value;
}

describe('SqliteRoasterRepository', () => {
  it('starts with Skywalker active and the Simulator', async () => {
    const [skywalker, simulator] = await listed(setup().repository);
    expect(skywalker).toMatchObject({
      id: 1,
      model: 'skywalker',
      active: true,
      connection: null,
      batchIdealG: 375,
      coolerHelpsDrum: true,
      tuning: { holdS: 150, target: { kp: 1.5 } },
    });
    expect(simulator).toMatchObject({
      id: 2,
      model: 'simulator',
      active: false,
      coolerHelpsDrum: false,
      connection: { kind: 'simulator' },
    });
  });

  it('adds a record and reads it back whole', async () => {
    const { repository } = setup();
    const [skywalker] = await listed(repository);
    if (!skywalker) throw new Error('no roaster');
    const { id, ...fields } = skywalker;
    expect(id).toBe(1);
    const added = await repository.add({
      ...fields,
      name: 'Second',
      active: false,
      coolerHelpsDrum: false,
    });
    expect(added).toMatchObject({ ok: true, value: { id: 3, name: 'Second' } });
    expect((await listed(repository)).at(-1)).toMatchObject({
      id: 3,
      name: 'Second',
      coolerHelpsDrum: false,
    });
  });

  it('saves changes, the connection and gains included', async () => {
    const { repository } = setup();
    const [skywalker] = await listed(repository);
    if (!skywalker) throw new Error('no roaster');
    const next: Roaster = {
      ...skywalker,
      connection: { kind: 'serial', path: 'COM3' },
      maxTempC: 230,
      tuning: { ...skywalker.tuning, holdS: 90 },
    };
    await repository.save(next);
    expect((await listed(repository))[0]).toEqual(next);
  });

  it('keeps exactly one active', async () => {
    const { repository } = setup();
    await repository.setActive(2);
    const active = (await listed(repository)).filter((r) => r.active);
    expect(active.map((r) => r.id)).toEqual([2]);
  });

  it('refuses to activate one that is not there, leaving the active one', async () => {
    const { repository } = setup();
    expect(await repository.setActive(9)).toEqual({
      ok: false,
      error: { kind: 'not-found', id: 9 },
    });
    expect((await listed(repository))[0]?.active).toBe(true);
  });

  it('counts what belongs to a roaster', async () => {
    const { repository, roasts } = setup();
    await roasts.create({
      startedAt: 'x',
      mode: 'manual',
      profile: null,
      roasterId: 2,
      beanId: null,
      batchG: null,
      ghostRoastId: null,
    });
    expect(await repository.usage(2)).toEqual({ ok: true, value: { roasts: 1, profiles: 0 } });
    expect(await repository.usage(1)).toEqual({ ok: true, value: { roasts: 0, profiles: 0 } });
  });

  it('deletes a record, and says when there is none', async () => {
    const { repository } = setup();
    expect(await repository.delete(2)).toEqual({ ok: true, value: undefined });
    expect(await repository.delete(2)).toEqual({ ok: false, error: { kind: 'not-found', id: 2 } });
  });

  it('skips and logs a row it can no longer read', async () => {
    const { repository, sqlite, entries } = setup();
    sqlite.exec(`UPDATE roasters SET pid = '{"old":true}' WHERE id = 2`);
    expect((await listed(repository)).map((r) => r.id)).toEqual([1]);
    expect(entries.map((e) => e.event)).toContain('storage.roaster-unreadable');
  });
});
