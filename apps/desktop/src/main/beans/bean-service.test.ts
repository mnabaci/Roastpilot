import { silentLogger, type BeanRepository } from '@roastpilot/core';
import { err, NO_ROAST_SETUP, ok, type Bean, type BeanFields } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { BeanService } from './bean-service';

const BEAN = { id: 1, name: 'Yirgacheffe' } as Bean;
const FIELDS = { name: 'Yirgacheffe' } as BeanFields;

function setup(repository: Partial<BeanRepository> = {}) {
  const onChange = vi.fn();
  const fake: BeanRepository = {
    list: () => Promise.resolve(ok([BEAN])),
    add: () => Promise.resolve(ok(1)),
    addAll: (list) => Promise.resolve(ok(list.map((_, i) => i + 1))),
    update: () => Promise.resolve(ok(undefined)),
    setArchived: () => Promise.resolve(ok(undefined)),
    addStock: () => Promise.resolve(ok(undefined)),
    adjustStock: () => Promise.resolve(ok(undefined)),
    ...repository,
  };
  return { onChange, beans: new BeanService({ repository: fake, onChange, logger: silentLogger }) };
}

describe('BeanService', () => {
  it('tells the windows after each change', async () => {
    const { beans, onChange } = setup();
    await beans.add(FIELDS);
    await beans.update({ id: 1, fields: FIELDS, profileId: null });
    await beans.setArchived({ id: 1, archived: true });
    await beans.addStock({ beanId: 1, grams: 10, purchasedAt: 'x' });
    await beans.adjustStock({ beanId: 1, greenG: 1, roastedG: 2 });
    expect(onChange).toHaveBeenCalledTimes(5);
    expect(onChange).toHaveBeenLastCalledWith([BEAN]);
  });

  it('adds imported beans at once, then tells the windows', async () => {
    const { beans, onChange } = setup();
    expect(await beans.addAll([{ fields: FIELDS, profileId: null }])).toEqual(ok([1]));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('a failed write says why and tells no one', async () => {
    const failed = err({ kind: 'storage-failed' as const, message: 'disk full' });
    const { beans, onChange } = setup({ add: () => Promise.resolve(failed) });
    expect(await beans.add(FIELDS)).toEqual(failed);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an unreadable list is empty, so the screen still opens', async () => {
    const failed = err({ kind: 'storage-failed' as const, message: 'x' });
    const { beans } = setup({ list: () => Promise.resolve(failed) });
    expect(await beans.list()).toEqual([]);
  });

  it('keeps what the next roast is of until it changes', () => {
    const { beans } = setup();
    expect(beans.setup).toEqual(NO_ROAST_SETUP);
    const chosen = { beanId: 1, batchG: 375, ghostRoastId: null };
    beans.setSetup(chosen);
    expect(beans.setup).toEqual(chosen);
  });
});

describe('BeanService find and linkProfile', () => {
  const FULL_FIELDS: BeanFields = {
    name: 'Yirgacheffe',
    origin: 'Ethiopia',
    process: 'washed',
    variety: null,
    altitudeM: null,
    densityGL: null,
    moisturePct: null,
    screen: null,
    decaf: false,
    supplier: null,
    species: null,
    link: null,
    lowStockG: 0,
    notes: null,
  };
  const FULL: Bean = {
    ...FULL_FIELDS,
    id: 1,
    profileId: null,
    greenG: 300,
    roastedG: 0,
    archived: false,
    avgLossPct: null,
  };

  it('finds a bean by id, archived ones too, and says when there is none', async () => {
    const archived = { ...FULL, id: 2, archived: true };
    const { beans } = setup({ list: () => Promise.resolve(ok([FULL, archived])) });
    expect(await beans.find(2)).toEqual(ok(archived));
    expect(await beans.find(9)).toEqual(err({ kind: 'not-found', id: 9 }));
  });

  it('passes on a list that cannot be read', async () => {
    const failed = err({ kind: 'storage-failed' as const, message: 'x' });
    const { beans } = setup({ list: () => Promise.resolve(failed) });
    expect(await beans.find(1)).toEqual(failed);
  });

  it('links a profile keeping the bean as it is, then tells the windows', async () => {
    const update = vi.fn(() => Promise.resolve(ok(undefined)));
    const { beans, onChange } = setup({ update });
    expect(await beans.linkProfile(FULL, 'custom-9')).toEqual(ok(undefined));
    expect(update).toHaveBeenCalledWith(1, FULL_FIELDS, 'custom-9');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
