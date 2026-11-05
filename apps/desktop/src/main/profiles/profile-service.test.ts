import { silentLogger, type ProfileRepository } from '@roastpilot/core';
import { SKYWALKER_PROFILES } from '@roastpilot/drivers';
import { err, ok, type AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ProfileService } from './profile-service';

const MINE: AutoProfile = { ...SKYWALKER_PROFILES['light-steps'], id: 'custom-a', name: 'Mine' };

function setup(start: AutoProfile[] = []) {
  let stored = [...start];
  let chosen = 'light-steps';
  const store: ProfileRepository = {
    list: () => Promise.resolve(ok(stored)),
    save: (profile) => {
      stored = [...stored.filter((p) => p.id !== profile.id), profile];
      return Promise.resolve(ok(undefined));
    },
    delete: (id) => {
      const had = stored.some((p) => p.id === id);
      stored = stored.filter((p) => p.id !== id);
      return Promise.resolve(ok(had));
    },
  };
  const service = new ProfileService({
    store,
    newId: () => 'custom-new',
    chosenId: () => chosen,
    logger: silentLogger,
  });
  return {
    service,
    stored: () => stored,
    choose: (id: string) => {
      chosen = id;
    },
  };
}

describe('ProfileService', () => {
  it('lists the built-ins first, then your own', async () => {
    const { service } = setup([MINE]);
    const list = await service.list();
    expect(list.map((e) => [e.profile.id, e.builtIn])).toEqual([
      ['light-steps', true],
      ['light-curve', true],
      ['custom-a', false],
    ]);
  });

  it('still lists the built-ins when storage fails', async () => {
    const failing: ProfileRepository = {
      list: () => Promise.resolve(err({ kind: 'storage-failed', message: 'gone' })),
      save: () => Promise.resolve(err({ kind: 'storage-failed', message: 'gone' })),
      delete: () => Promise.resolve(err({ kind: 'storage-failed', message: 'gone' })),
    };
    const service = new ProfileService({
      store: failing,
      newId: () => 'x',
      chosenId: () => 'light-steps',
      logger: silentLogger,
    });
    expect(await service.list()).toHaveLength(2);
    expect(await service.duplicate('light-steps')).toEqual({
      ok: false,
      error: { kind: 'storage-failed', message: 'gone' },
    });
  });

  it('duplicates a built-in as your own, leaving the original alone', async () => {
    const { service, stored } = setup();
    const copy = await service.duplicate('light-steps');
    expect(copy).toMatchObject({
      ok: true,
      value: { builtIn: false, profile: { id: 'custom-new', name: 'Light · Steps copy' } },
    });
    expect(stored().map((p) => p.id)).toEqual(['custom-new']);
  });

  it('refuses to duplicate a profile it does not know', async () => {
    const { service } = setup();
    expect(await service.duplicate('nope')).toEqual({
      ok: false,
      error: { kind: 'not-found', id: 'nope' },
    });
  });

  it('refuses to overwrite or delete a built-in', async () => {
    const { service, stored } = setup();
    const builtIn = SKYWALKER_PROFILES['light-steps'];
    expect(await service.save({ ...builtIn, name: 'Mine now' })).toEqual({
      ok: false,
      error: { kind: 'built-in', id: 'light-steps' },
    });
    expect(await service.delete('light-steps')).toEqual({
      ok: false,
      error: { kind: 'built-in', id: 'light-steps' },
    });
    expect(stored()).toEqual([]);
  });

  it('runs the chosen profile, and the default once it is deleted', async () => {
    const { service, choose } = setup([MINE]);
    await service.list();
    choose('custom-a');
    expect(service.active().name).toBe('Mine');
    await service.save({ ...MINE, name: 'Edited' });
    expect(service.active().name).toBe('Edited');
    await service.delete('custom-a');
    expect(service.active().id).toBe('light-steps');
  });

  it('says when there was nothing to delete', async () => {
    const { service } = setup();
    expect(await service.delete('nope')).toEqual({
      ok: false,
      error: { kind: 'not-found', id: 'nope' },
    });
  });
});
