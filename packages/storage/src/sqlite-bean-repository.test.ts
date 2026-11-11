import { createLogger } from '@roastpilot/core';
import type { BeanFields } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './open-database';
import { drizzleOn } from './proxy-db';
import { SqliteBeanRepository } from './sqlite-bean-repository';
import { SqliteRoastRepository } from './sqlite-roast-repository';

const FIELDS: BeanFields = {
  name: 'Yirgacheffe',
  origin: 'Ethiopia',
  process: 'washed',
  variety: null,
  altitudeM: 1900,
  densityGL: 780,
  moisturePct: null,
  screen: null,
  decaf: false,
  supplier: null,
  species: null,
  link: null,
  lowStockG: 500,
  notes: null,
};

function setup() {
  const logger = createLogger({ write: () => undefined }, 'storage');
  const opened = openDatabase(':memory:', logger);
  if (!opened.ok) throw new Error(opened.error.kind);
  const db = drizzleOn(opened.value);
  return {
    sqlite: opened.value,
    beans: new SqliteBeanRepository(db),
    roasts: new SqliteRoastRepository(db, logger),
  };
}

async function added(beans: SqliteBeanRepository) {
  const result = await beans.add(FIELDS);
  if (!result.ok) throw new Error('add failed');
  return result.value;
}

async function one(beans: SqliteBeanRepository) {
  const list = await beans.list();
  if (!list.ok || !list.value[0]) throw new Error('no bean');
  return list.value[0];
}

const newRoast = {
  startedAt: '2026-11-04T10:00:00.000Z',
  mode: 'manual',
  profile: null,
  roasterId: null,
  ghostRoastId: null,
} as const;

describe('SqliteBeanRepository', () => {
  it('adds many at once, with no stock, not archived, each with its profile', async () => {
    const { beans } = setup();
    const ids = await beans.addAll([
      { fields: FIELDS, profileId: 'light-steps' },
      { fields: { ...FIELDS, name: 'Guji' }, profileId: null },
    ]);
    expect(ids).toEqual({ ok: true, value: [1, 2] });
    const list = await beans.list();
    expect(list.ok && list.value.map((b) => [b.name, b.profileId, b.greenG, b.archived])).toEqual([
      ['Guji', null, 0, false],
      ['Yirgacheffe', 'light-steps', 0, false],
    ]);
  });

  it('adds none from an empty list', async () => {
    expect(await setup().beans.addAll([])).toEqual({ ok: true, value: [] });
  });

  it('adds a bean with no stock and reads it back', async () => {
    const { beans } = setup();
    const id = await added(beans);
    expect(await one(beans)).toEqual({
      ...FIELDS,
      id,
      profileId: null,
      greenG: 0,
      roastedG: 0,
      archived: false,
      avgLossPct: null,
    });
  });

  it('adds stock to the green stock', async () => {
    const { beans } = setup();
    const beanId = await added(beans);
    await beans.addStock({ beanId, grams: 1000, purchasedAt: '2026-11-01' });
    await beans.addStock({ beanId, grams: 200, purchasedAt: '2026-11-02' });
    expect(await one(beans)).toMatchObject({ greenG: 1200 });
  });

  it('adjusts stock by hand', async () => {
    const { beans } = setup();
    const beanId = await added(beans);
    await beans.adjustStock({ beanId, greenG: 321, roastedG: 45 });
    expect(await one(beans)).toMatchObject({ greenG: 321, roastedG: 45 });
  });

  it('keeps an adjustment on the day it was picked', async () => {
    const { beans } = setup();
    const beanId = await added(beans);
    await beans.adjustStock({ beanId, greenG: 900, reason: 'taken', adjustedOn: '2026-11-02' });
    const history = await beans.stockHistory(beanId);
    expect(history.ok && history.value.at(-1)).toMatchObject({ at: '2026-11-02', kind: 'taken' });
  });

  it('keeps roasted stock as it is when an adjustment leaves it out', async () => {
    const { beans } = setup();
    const beanId = await added(beans);
    await beans.adjustStock({ beanId, greenG: 321, roastedG: 45 });
    await beans.adjustStock({ beanId, greenG: 300 });
    expect(await one(beans)).toMatchObject({ greenG: 300, roastedG: 45 });
  });

  it('keeps what an adjustment changed, and nothing when it changed nothing', async () => {
    const { beans } = setup();
    const beanId = await added(beans);
    await beans.addStock({ beanId, grams: 1000, purchasedAt: '2026-11-01' });
    await beans.adjustStock({ beanId, greenG: 950, roastedG: 0 });
    await beans.adjustStock({ beanId, greenG: 950, roastedG: 0 });
    await beans.adjustStock({ beanId, greenG: 1350, roastedG: 0, reason: 'returned' });
    await beans.adjustStock({
      beanId,
      greenG: 1150,
      roastedG: 0,
      reason: 'taken',
      note: 'Gave 200 g to Sam',
    });
    const history = await beans.stockHistory(beanId);
    expect(history.ok && history.value).toMatchObject([
      { at: '2026-11-01', kind: 'bought', greenG: 1000, roastedG: 0, roastId: null },
      { kind: 'counted', greenG: -50, roastedG: 0 },
      { kind: 'returned', greenG: 400, roastedG: 0, note: null },
      { kind: 'taken', greenG: -200, roastedG: 0, note: 'Gave 200 g to Sam' },
    ]);
  });

  it('updates fields and the bean own profile', async () => {
    const { beans } = setup();
    const id = await added(beans);
    await beans.update(id, { ...FIELDS, name: 'Renamed' }, 'custom-1');
    expect(await one(beans)).toMatchObject({ name: 'Renamed', profileId: 'custom-1' });
  });

  it('archives and brings back', async () => {
    const { beans } = setup();
    const id = await added(beans);
    await beans.setArchived(id, true);
    expect(await one(beans)).toMatchObject({ archived: true });
    await beans.setArchived(id, false);
    expect(await one(beans)).toMatchObject({ archived: false });
  });

  it('says when the bean is not there', async () => {
    const { beans } = setup();
    const notFound = { ok: false, error: { kind: 'not-found', id: 9 } };
    expect(await beans.setArchived(9, true)).toEqual(notFound);
    expect(await beans.update(9, FIELDS, null)).toEqual(notFound);
    expect(await beans.adjustStock({ beanId: 9, greenG: 1, roastedG: 1 })).toEqual(notFound);
    expect(await beans.addStock({ beanId: 9, grams: 1, purchasedAt: 'x' })).toEqual(notFound);
  });

  describe('with roasts', () => {
    async function roasted() {
      const all = setup();
      const beanId = await added(all.beans);
      await all.beans.addStock({ beanId, grams: 1000, purchasedAt: 'x' });
      const made = await all.roasts.create({ ...newRoast, beanId, batchG: 400 });
      if (!made.ok) throw new Error('create failed');
      return { ...all, beanId, roastId: made.value };
    }
    const result = (id: number, roastedG: number | null) => ({
      id,
      batchG: 400,
      roastedG,
      rating: null,
      isFavourite: false,
      notes: null,
    });

    it('Start takes the batch off green stock', async () => {
      const { beans } = await roasted();
      expect(await one(beans)).toMatchObject({ greenG: 600 });
    });

    it('stock stops at 0', async () => {
      const { beans, roasts, beanId } = await roasted();
      await roasts.create({ ...newRoast, beanId, batchG: 900 });
      expect(await one(beans)).toMatchObject({ greenG: 0 });
    });

    it('no bean or no batch changes nothing', async () => {
      const { beans, roasts, beanId } = await roasted();
      await roasts.create({ ...newRoast, beanId: null, batchG: 300 });
      await roasts.create({ ...newRoast, beanId, batchG: null });
      expect(await one(beans)).toMatchObject({ greenG: 600 });
    });

    it('a roasted weight adds to roasted stock and the average loss', async () => {
      const { beans, roasts, roastId } = await roasted();
      await roasts.saveResult(result(roastId, 340));
      expect(await one(beans)).toMatchObject({ roastedG: 340, avgLossPct: 15 });
    });

    it('changing the roasted weight adds only the difference; clearing takes it back', async () => {
      const { beans, roasts, roastId } = await roasted();
      await roasts.saveResult(result(roastId, 340));
      await roasts.saveResult(result(roastId, 350));
      expect(await one(beans)).toMatchObject({ roastedG: 350 });
      await roasts.saveResult(result(roastId, null));
      expect(await one(beans)).toMatchObject({ roastedG: 0, avgLossPct: null });
    });

    it('changing the batch weight moves green stock by the difference', async () => {
      const { beans, roasts, roastId } = await roasted();
      await roasts.saveResult({ ...result(roastId, null), batchG: 350 });
      expect(await one(beans)).toMatchObject({ greenG: 650 });
    });

    it('clearing the batch gives it back, and retyping takes it once', async () => {
      const { beans, roasts, roastId } = await roasted();
      await roasts.saveResult({ ...result(roastId, null), batchG: null });
      expect(await one(beans)).toMatchObject({ greenG: 1000 });
      await roasts.saveResult(result(roastId, null));
      expect(await one(beans)).toMatchObject({ greenG: 600 });
    });

    it('a roasted weight above the green one stays out of the average', async () => {
      const { beans, roasts, roastId } = await roasted();
      await roasts.saveResult(result(roastId, 3200));
      expect(await one(beans)).toMatchObject({ avgLossPct: null });
    });

    it('stock history has its roasts made here, in time order, and not imported ones', async () => {
      const { beans, roasts, beanId, roastId } = await roasted();
      await roasts.saveResult(result(roastId, 340));
      await roasts.create({
        ...newRoast,
        startedAt: '2026-10-01T09:00:00.000Z',
        beanId,
        batchG: 300,
        imported: true,
      });
      const history = await beans.stockHistory(beanId);
      expect(history.ok && history.value).toEqual([
        {
          at: '2026-11-04T10:00:00.000Z',
          kind: 'roasted',
          greenG: -400,
          roastedG: 340,
          roastId,
          note: null,
        },
        { at: 'x', kind: 'bought', greenG: 1000, roastedG: 0, roastId: null, note: null },
      ]);
    });

    it('deleting a roast gives no stock back', async () => {
      const { beans, roasts, roastId } = await roasted();
      await roasts.delete(roastId);
      expect(await one(beans)).toMatchObject({ greenG: 600 });
    });

    it('deleting a roast used as a ghost leaves the other roast, without its ghost', async () => {
      const { roasts, roastId } = await roasted();
      const later = await roasts.create({
        ...newRoast,
        beanId: null,
        batchG: null,
        ghostRoastId: roastId,
      });
      if (!later.ok) throw new Error('create failed');
      expect(await roasts.delete(roastId)).toEqual({ ok: true, value: undefined });
      expect(await roasts.get(later.value)).toMatchObject({
        ok: true,
        value: { ghostRoastId: null },
      });
    });
  });
});
