import { describe, expect, it } from 'vitest';
import { BEAN, failed, newRoast, result, roastOn, setup } from './test-stores';
import { TEST_PROFILE } from './test-profile';

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

  it('create: no roast and no stock moved when writing its stock log row fails', async () => {
    const env = setup();
    const before = env.snapshot();
    env.failOn('INSERT', 'bean_stock_movements');
    expect(await env.roasts.create(newRoast)).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('saveResult: neither the weights nor the stock change when its log row fails', async () => {
    const env = setup();
    const id = await roastOn(env);
    const before = env.snapshot();
    env.failOn('UPDATE', 'bean_stock_movements');
    expect(await env.roasts.saveResult(result(id, 300))).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('setBean: the roast stays on its bean when moving its log row fails', async () => {
    const env = setup();
    const id = await roastOn(env);
    const before = env.snapshot();
    env.failOn('UPDATE', 'bean_stock_movements');
    expect(await env.roasts.setBean(id, 2)).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('adjustStock: the stock stays when writing what changed fails', async () => {
    const env = setup();
    const before = env.snapshot();
    env.failOn('INSERT', 'bean_stock_movements');
    expect(await env.beans.adjustStock({ beanId: 1, greenG: 800, reason: 'taken' })).toMatchObject(
      failed,
    );
    expect(env.snapshot()).toEqual(before);
  });

  it('addStock: no stock without its stock log row', async () => {
    const env = setup();
    const before = env.snapshot();
    env.failOn('INSERT', 'bean_stock_movements');
    expect(await env.beans.addStock({ beanId: 1, grams: 500, purchasedAt: 'x' })).toMatchObject(
      failed,
    );
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

  it('beans addAll: no bean comes in when a later one fails', async () => {
    const env = setup();
    const before = env.snapshot();
    env.failOn('INSERT', 'beans', "NEW.name = 'Second'");
    const fields = { ...BEAN, name: 'First' };
    expect(
      await env.beans.addAll([
        { fields, profileId: null },
        { fields: { ...fields, name: 'Second' }, profileId: null },
      ]),
    ).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('profiles saveAll: no profile comes in when a later one fails', async () => {
    const env = setup();
    const before = env.snapshot();
    env.failOn('INSERT', 'profiles', "NEW.id = 'custom-2'");
    expect(
      await env.profiles.saveAll([TEST_PROFILE, { ...TEST_PROFILE, id: 'custom-2' }], 1),
    ).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
  });

  it('profiles deleteMany: none goes, and no bean loses its link, when a later one fails', async () => {
    const env = setup();
    await env.profiles.saveAll([TEST_PROFILE, { ...TEST_PROFILE, id: 'custom-2' }], 1);
    env.sqlite.exec(`UPDATE beans SET profile_id = '${TEST_PROFILE.id}' WHERE id = 1`);
    const links = () => env.sqlite.prepare('SELECT id, profile_id FROM beans ORDER BY id').all();
    const linked = links();
    const before = env.snapshot();
    env.failOn('DELETE', 'profiles', "OLD.id = 'custom-2'");
    expect(await env.profiles.deleteMany([TEST_PROFILE.id, 'custom-2'])).toMatchObject(failed);
    expect(env.snapshot()).toEqual(before);
    expect(links()).toEqual(linked);
  });

  it('roasters addAll: no roaster comes in when a later one fails', async () => {
    const env = setup();
    const listed = await env.roasters.list();
    const first = listed.ok ? listed.value[0] : undefined;
    if (!first) throw new Error('no roaster');
    const { id, ...record } = first;
    expect(id).toBe(1);
    const before = env.snapshot();
    env.failOn('INSERT', 'roasters', "NEW.name = 'Second'");
    expect(
      await env.roasters.addAll([
        { ...record, name: 'First', active: false },
        { ...record, name: 'Second', active: false },
      ]),
    ).toMatchObject(failed);
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
