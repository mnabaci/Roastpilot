import { createLogger } from '@roastpilot/core';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './open-database';
import { drizzleOn } from './proxy-db';
import { SqliteBeanRepository } from './sqlite-bean-repository';
import { SqliteRoastRepository } from './sqlite-roast-repository';
import { SqliteRoasterRepository } from './sqlite-roaster-repository';

/** Two beans with 1000 g green each, and a way to make a later statement fail. */
function setup() {
  const logger = createLogger({ write: () => undefined }, 'storage');
  const opened = openDatabase(':memory:', logger);
  if (!opened.ok) throw new Error(opened.error.kind);
  const sqlite = opened.value;
  sqlite.exec(`INSERT INTO beans (name, origin, process, green_g) VALUES
    ('Ethiopia', 'Ethiopia', 'Washed', 1000), ('Colombia', 'Colombia', 'Natural', 1000)`);
  const db = drizzleOn(sqlite);
  /** Everything a stock write can touch, to compare before and after. */
  const snapshot = () => ({
    beans: sqlite.prepare('SELECT id, green_g, roasted_g FROM beans ORDER BY id').all(),
    roasts: sqlite.prepare('SELECT * FROM roasts ORDER BY id').all(),
    samples: sqlite.prepare('SELECT count(*) AS n FROM roast_samples').get(),
    purchases: sqlite.prepare('SELECT * FROM bean_purchases ORDER BY id').all(),
    roasters: sqlite.prepare('SELECT id, is_active FROM roasters ORDER BY id').all(),
  });
  /** From now on, `event` on `table` fails (when `when` holds), as a broken statement would. */
  const failOn = (event: string, table: string, when = '1') => {
    sqlite.exec(`CREATE TRIGGER fail_${table} BEFORE ${event} ON ${table} WHEN ${when}
      BEGIN SELECT RAISE(ABORT, 'disk said no'); END`);
  };
  return {
    sqlite,
    snapshot,
    failOn,
    roasts: new SqliteRoastRepository(db, logger),
    beans: new SqliteBeanRepository(db),
    roasters: new SqliteRoasterRepository(db, logger),
  };
}

const failed = { ok: false, error: { kind: 'storage-failed' } };
const newRoast = {
  startedAt: '2026-11-04T10:00:00.000Z',
  mode: 'manual',
  profile: null,
  roasterId: null,
  ghostRoastId: null,
  beanId: 1,
  batchG: 400,
} as const;
const result = (id: number, roastedG: number | null) => ({
  id,
  batchG: 400,
  roastedG,
  rating: null,
  isFavourite: false,
  notes: null,
});

async function roastOn(env: ReturnType<typeof setup>) {
  const made = await env.roasts.create(newRoast);
  if (!made.ok) throw new Error('create failed');
  await env.roasts.saveResult(result(made.value, 340));
  return made.value;
}

describe('all-or-nothing writes', () => {
  it('create: no roast row when taking the batch off stock fails', async () => {
    const env = setup();
    const before = env.snapshot();
    env.failOn('UPDATE', 'beans');
    expect(await env.roasts.create(newRoast)).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('saveResult: the result is not saved when moving roasted stock fails', async () => {
    const env = setup();
    const id = await roastOn(env);
    const before = env.snapshot();
    env.failOn('UPDATE', 'beans');
    expect(await env.roasts.saveResult(result(id, 300))).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('setBean: nothing moves when putting stock on the new bean fails', async () => {
    const env = setup();
    const id = await roastOn(env);
    const before = env.snapshot();
    // The old bean gets its beans back first; taking them off the new one then fails.
    env.failOn('UPDATE', 'beans', 'OLD.id = 2');
    expect(await env.roasts.setBean(id, 2)).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('addStock: no stock without its purchase row', async () => {
    const env = setup();
    const before = env.snapshot();
    env.failOn('INSERT', 'bean_purchases');
    expect(
      await env.beans.addStock({ beanId: 1, grams: 500, purchasedAt: 'x', plan: null }),
    ).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('addSamples: no samples at all when a later chunk fails', async () => {
    const env = setup();
    const made = await env.roasts.create({ ...newRoast, beanId: null });
    if (!made.ok) throw new Error('create failed');
    const before = env.snapshot();
    env.failOn('INSERT', 'roast_samples', 'NEW.t_s = 900');
    const samples = Array.from({ length: 1_000 }, (_, i) => ({ tS: i, values: { bt: i } }));
    expect(await env.roasts.addSamples(made.value, samples)).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('setActive: the old roaster stays active when turning it off fails', async () => {
    const env = setup();
    const before = env.snapshot();
    env.failOn('UPDATE', 'roasters', 'NEW.is_active = 0');
    expect(await env.roasters.setActive(2)).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('overlapping results for one roast move stock once each, never twice', async () => {
    const env = setup();
    const made = await env.roasts.create(newRoast);
    if (!made.ok) throw new Error('create failed');
    const [first, second] = await Promise.all([
      env.roasts.saveResult(result(made.value, 340)),
      env.roasts.saveResult(result(made.value, 300)),
    ]);
    expect([first.ok, second.ok]).toEqual([true, true]);
    expect(env.snapshot().beans[0]).toEqual({ id: 1, green_g: 600, roasted_g: 300 });
  });

  it('overlapping bean changes leave the batch on exactly one bean', async () => {
    const env = setup();
    const id = await roastOn(env);
    await Promise.all([env.roasts.setBean(id, 2), env.roasts.setBean(id, 2)]);
    expect(env.snapshot().beans).toEqual([
      { id: 1, green_g: 1000, roasted_g: 0 },
      { id: 2, green_g: 600, roasted_g: 340 },
    ]);
  });
});
