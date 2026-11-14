import { err } from '@roastpilot/shared';
import { BUILT_IN_ROASTERS } from '@roastpilot/drivers';
import { describe, expect, it } from 'vitest';
import { setup } from './roaster-service-fixture';

describe('RoasterService', () => {
  it('starts on the built-in Skywalker, before anything loads', () => {
    expect(setup().service.active().name).toBe('Skywalker');
  });

  it('keeps the built-ins when the database cannot be read', async () => {
    const { service, repository } = setup();
    repository.list = () => Promise.resolve(err({ kind: 'storage-failed', message: 'gone' }));
    expect((await service.load()).map((r) => r.name)).toEqual(['Skywalker', 'Simulator']);
  });

  it('adds a roaster with its model starting values, not active', async () => {
    const { service, onChange } = setup();
    await service.load();
    const added = await service.add({ name: 'Second', model: 'skywalker' });
    expect(added).toMatchObject({
      ok: true,
      value: { name: 'Second', active: false, batchIdealG: 375, maxTempC: 240 },
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('adds imported records at once, none active, and tells the windows', async () => {
    const { service, onChange, stored } = setup();
    await service.load();
    const [skywalker] = BUILT_IN_ROASTERS;
    if (!skywalker) throw new Error('no roaster');
    const { id, ...record } = skywalker;
    expect(id).toBe(1);
    const added = await service.addAll([{ ...record, name: 'Friend', active: false }]);
    expect(added.ok && added.value.map((r) => [r.id, r.name, r.active])).toEqual([
      [3, 'Friend', false],
    ]);
    expect(service.all.map((r) => r.name)).toEqual(['Skywalker', 'Simulator', 'Friend']);
    expect(stored()).toHaveLength(3);
    expect(onChange).toHaveBeenLastCalledWith(service.all);
  });

  it('an import that fails to save adds nothing', async () => {
    const { service, repository, onChange } = setup();
    repository.addAll = () => Promise.resolve(err({ kind: 'storage-failed', message: 'full' }));
    expect(await service.addAll([])).toEqual(err({ kind: 'storage-failed', message: 'full' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('switches the active roaster', async () => {
    const { service, onChange } = setup();
    await service.load();
    await service.setActive(2);
    expect(service.active().name).toBe('Simulator');
    expect(onChange.mock.lastCall?.[0]).toHaveLength(2);
  });

  it('refuses every change while a roaster is connected', async () => {
    const { service, connect, stored } = setup();
    await service.load();
    connect();
    const [skywalker] = BUILT_IN_ROASTERS;
    if (!skywalker) throw new Error('no built-in');
    const inUse = { ok: false, error: { kind: 'in-use' } };
    expect(await service.save({ ...skywalker, maxTempC: 100 })).toEqual(inUse);
    expect(await service.setActive(2)).toEqual(inUse);
    expect(await service.chooseConnection({ kind: 'simulator' })).toEqual(inUse);
    expect(stored()[0]?.maxTempC).toBe(240);
    expect(service.active().name).toBe('Skywalker');
  });

  it('never lets a save change the model or which one is active', async () => {
    const { service, stored } = setup();
    await service.load();
    const [, simulator] = BUILT_IN_ROASTERS;
    if (!simulator) throw new Error('no built-in');
    await service.save({ ...simulator, model: 'skywalker', active: true, name: 'Practice' });
    expect(stored()[1]).toMatchObject({ name: 'Practice', model: 'simulator', active: false });
  });

  it('will not delete the active one, or one with roasts or profiles', async () => {
    const busy = setup({ roasts: 3, profiles: 1 });
    await busy.service.load();
    expect(await busy.service.delete(1)).toEqual({ ok: false, error: { kind: 'active' } });
    expect(await busy.service.delete(2)).toEqual({
      ok: false,
      error: { kind: 'has-roasts', roasts: 3, profiles: 1 },
    });
    const free = setup();
    await free.service.load();
    expect(await free.service.delete(2)).toEqual({ ok: true, value: undefined });
    expect(free.stored().map((r) => r.id)).toEqual([1]);
  });

  it('picking a port keeps it on the Skywalker, and from the Simulator makes it active', async () => {
    const { service } = setup();
    await service.load();
    await service.setActive(2);
    const port = { kind: 'serial', path: '/dev/cu.usbserial-1' } as const;
    await service.chooseConnection(port);
    expect(service.active()).toMatchObject({ name: 'Skywalker', connection: port });
  });

  it('picking the Simulator makes it active', async () => {
    const { service } = setup();
    await service.load();
    await service.chooseConnection({ kind: 'simulator' });
    expect(service.active().name).toBe('Simulator');
  });
});
