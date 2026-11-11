import type { NewRoast } from '@roastpilot/core';
import { describe, expect, it } from 'vitest';
import { newRoast, result, setup } from './test-stores';

/** The bean stock log as stored, oldest row first. */
const rows = (env: ReturnType<typeof setup>) =>
  env.sqlite
    .prepare(
      'SELECT bean_id, at, kind, green_g, roasted_g, roast_id, note FROM bean_stock_movements ORDER BY id',
    )
    .all();

async function made(env: ReturnType<typeof setup>, roast: Partial<NewRoast> = {}) {
  const created = await env.roasts.create({ ...newRoast, ...roast });
  if (!created.ok) throw new Error('create failed');
  return created.value;
}

const roastedRow = (roastId: number | null, beanId = 1, greenG = -400, roastedG = 0) => ({
  bean_id: beanId,
  at: newRoast.startedAt,
  kind: 'roasted',
  green_g: greenG,
  roasted_g: roastedG,
  roast_id: roastId,
  note: null,
});

describe('the stock log', () => {
  it('Add writes a bought row', async () => {
    const env = setup();
    await env.beans.addStock({ beanId: 1, grams: 2000, purchasedAt: '2026-11-01' });
    expect(rows(env)).toEqual([
      {
        bean_id: 1,
        at: '2026-11-01',
        kind: 'bought',
        green_g: 2000,
        roasted_g: 0,
        roast_id: null,
        note: null,
      },
    ]);
  });

  it('an adjustment writes what it changed, on the day picked or now, none for no change', async () => {
    const env = setup();
    await env.beans.adjustStock({ beanId: 1, greenG: 900, adjustedOn: '2026-11-02' });
    await env.beans.adjustStock({ beanId: 1, greenG: 900 });
    await env.beans.adjustStock({ beanId: 1, greenG: 800, reason: 'taken', note: 'For Sam' });
    expect(rows(env)).toEqual([
      expect.objectContaining({ at: '2026-11-02', kind: 'counted', green_g: -100, note: null }),
      expect.objectContaining({ kind: 'taken', green_g: -100, roasted_g: 0, note: 'For Sam' }),
    ]);
    const [, taken] = rows(env) as { at: string }[];
    expect(taken?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('a roast made here writes its row at Start', async () => {
    const env = setup();
    const id = await made(env);
    expect(rows(env)).toEqual([roastedRow(id)]);
  });

  it('a roast with no bean, no batch, or imported writes none', async () => {
    const env = setup();
    await made(env, { beanId: null });
    await made(env, { batchG: null });
    const imported = await made(env, { imported: true });
    await env.roasts.saveResult(result(imported, 340));
    await env.roasts.setBean(imported, 2);
    expect(rows(env)).toEqual([]);
  });

  it('editing the weights keeps the row in step; clearing both takes it out', async () => {
    const env = setup();
    const id = await made(env);
    await env.roasts.saveResult({ ...result(id, 300), batchG: 350 });
    expect(rows(env)).toEqual([roastedRow(id, 1, -350, 300)]);
    await env.roasts.saveResult({ ...result(id, null), batchG: null });
    expect(rows(env)).toEqual([]);
    await env.roasts.saveResult(result(id, 340));
    expect(rows(env)).toEqual([roastedRow(id, 1, -400, 340)]);
  });

  it('a batch typed later on a roast started without one writes its row', async () => {
    const env = setup();
    const id = await made(env, { batchG: null });
    await env.roasts.saveResult(result(id, 340));
    expect(rows(env)).toEqual([roastedRow(id, 1, -400, 340)]);
  });

  it('changing the bean moves the row; no bean takes it out, a bean puts it back', async () => {
    const env = setup();
    const id = await made(env);
    await env.roasts.saveResult(result(id, 340));
    await env.roasts.setBean(id, 2);
    expect(rows(env)).toEqual([roastedRow(id, 2, -400, 340)]);
    await env.roasts.setBean(id, null);
    expect(rows(env)).toEqual([]);
    await env.roasts.setBean(id, 1);
    expect(rows(env)).toEqual([roastedRow(id, 1, -400, 340)]);
  });

  it('deleting the roast keeps its row with no roast, so the history still adds up', async () => {
    const env = setup();
    await env.beans.addStock({ beanId: 1, grams: 1000, purchasedAt: '2026-11-01' });
    const id = await made(env);
    await env.roasts.delete(id);
    const history = await env.beans.stockHistory(1);
    expect(history.ok && history.value).toEqual([
      { at: '2026-11-01', kind: 'bought', greenG: 1000, roastedG: 0, roastId: null, note: null },
      {
        at: newRoast.startedAt,
        kind: 'roasted',
        greenG: -400,
        roastedG: 0,
        roastId: null,
        note: null,
      },
    ]);
    // 1000 g to start with, then the log: +1000, −400.
    expect(env.snapshot().beans[0]).toMatchObject({ green_g: 1600 });
  });

  it('history: a day before that day’s roasts, ties in the order written, this bean only', async () => {
    const env = setup();
    await made(env, { startedAt: '2026-11-04T08:00:00.000Z' });
    await env.beans.addStock({ beanId: 1, grams: 500, purchasedAt: '2026-11-04' });
    await env.beans.addStock({ beanId: 1, grams: 300, purchasedAt: '2026-11-04' });
    await env.beans.addStock({ beanId: 2, grams: 700, purchasedAt: '2026-11-01' });
    const history = await env.beans.stockHistory(1);
    expect(history.ok && history.value.map((m) => [m.kind, m.greenG])).toEqual([
      ['bought', 500],
      ['bought', 300],
      ['roasted', -400],
    ]);
  });

  it('skips and logs a row whose kind this app does not know', async () => {
    const env = setup();
    await env.beans.addStock({ beanId: 1, grams: 500, purchasedAt: '2026-11-01' });
    env.sqlite.exec(`INSERT INTO bean_stock_movements (bean_id, at, kind, green_g, roasted_g)
      VALUES (1, '2026-11-02', 'sold', 0, -100)`);
    const history = await env.beans.stockHistory(1);
    expect(history.ok && history.value.map((m) => m.kind)).toEqual(['bought']);
    expect(env.entries.find((e) => e.event === 'storage.stock-row-unreadable')?.context).toEqual({
      beanId: 1,
      skipped: 1,
    });
  });
});
