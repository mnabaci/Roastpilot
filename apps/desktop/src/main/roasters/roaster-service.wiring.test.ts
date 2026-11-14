import { DEFAULT_TC4_WIRING, err } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { setup } from './roaster-service-fixture';

describe('RoasterService.saveWiring', () => {
  async function withTc4() {
    const ctx = setup();
    const added = await ctx.service.add({ name: 'Popper', model: 'tc4' });
    if (!added.ok) throw new Error('add failed');
    return { ...ctx, id: added.value.id };
  }
  const wiring = { ...DEFAULT_TC4_WIRING, etInput: 0, fanOutput: 'IO3' } as const;

  it('saves the wiring and minimum fan even while connected', async () => {
    const { service, stored, connect, id } = await withTc4();
    connect();
    const saved = await service.saveWiring({ id, wiring, minFanHeatingPct: 40 }, false);
    expect(saved).toMatchObject({ ok: true, value: { wiring, minFanHeatingPct: 40 } });
    expect(stored().find((r) => r.id === id)).toMatchObject({ wiring, minFanHeatingPct: 40 });
  });

  it('refuses while a roast runs', async () => {
    const { service, id } = await withTc4();
    expect(await service.saveWiring({ id, wiring, minFanHeatingPct: 0 }, true)).toEqual(
      err({ kind: 'roasting' }),
    );
  });

  it('says when the roaster is gone', async () => {
    const { service } = await withTc4();
    expect(await service.saveWiring({ id: 99, wiring, minFanHeatingPct: 0 }, false)).toEqual(
      err({ kind: 'not-found', id: 99 }),
    );
  });

  it("a save of the whole record leaves its wiring and minimum fan alone: they're saved here", async () => {
    const { service, stored, id } = await withTc4();
    await service.saveWiring({ id, wiring, minFanHeatingPct: 40 }, false);
    const stale = stored().find((r) => r.id === id);
    if (!stale) throw new Error('not stored');
    await service.save({
      ...stale,
      name: 'Popper 2',
      wiring: DEFAULT_TC4_WIRING,
      minFanHeatingPct: 0,
    });
    expect(stored().find((r) => r.id === id)).toMatchObject({
      name: 'Popper 2',
      wiring,
      minFanHeatingPct: 40,
    });
  });

  it('a roaster without wiring is a programmer error', async () => {
    const { service } = await withTc4();
    await expect(service.saveWiring({ id: 1, wiring, minFanHeatingPct: 0 }, false)).rejects.toThrow(
      /no wiring/,
    );
  });
});
