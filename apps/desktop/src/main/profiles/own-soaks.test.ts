import { silentLogger, type ProfileRepository } from '@roastpilot/core';
import { SKYWALKER_PROFILES } from '@roastpilot/drivers';
import { err, ok, type AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { setOwnSoaks } from './own-soaks';
import { ProfileService } from './profile-service';

const MINE: AutoProfile = { ...SKYWALKER_PROFILES['light-steps'], id: 'custom-a', name: 'Mine' };
const ELSEWHERE: AutoProfile = { ...MINE, id: 'custom-b', name: 'Other roaster' };
const NO_SOAK: AutoProfile = { ...MINE, id: 'custom-c', phases: MINE.phases.slice(1) };
const soakOf = (profile: AutoProfile | undefined) => profile?.phases[0]?.next;

/** Your own profiles in a store, `ELSEWHERE` on roaster 2; saving fails when `saveFails`. */
function setup(own: AutoProfile[], saveFails = false) {
  let stored = own.map((profile) => ({ profile, roasterId: profile === ELSEWHERE ? 2 : 1 }));
  const store: ProfileRepository = {
    list: () => Promise.resolve(ok(stored)),
    save: (profile, roasterId) => {
      if (saveFails) return Promise.resolve(err({ kind: 'storage-failed', message: 'full' }));
      stored = [...stored.filter((s) => s.profile.id !== profile.id), { profile, roasterId }];
      return Promise.resolve(ok(undefined));
    },
    saveAll: () => Promise.resolve(ok(undefined)),
    deleteMany: () => Promise.resolve(ok(0)),
  };
  const profiles = new ProfileService({
    store,
    newId: () => 'x',
    chosenId: () => 'light-steps',
    activeRoaster: () => ({ id: 1, model: 'skywalker' }),
    logger: silentLogger,
  });
  const byId = (id: string) => stored.find((s) => s.profile.id === id);
  return { store, profiles, byId };
}

describe('setOwnSoaks', () => {
  it('sets the soak of your own profiles that soak, on every roaster', async () => {
    const { store, profiles, byId } = setup([MINE, ELSEWHERE, NO_SOAK]);
    expect(await setOwnSoaks(90, { store, profiles })).toEqual(ok(2));
    expect(soakOf(byId('custom-a')?.profile)).toEqual({ on: 'time', afterS: 90 });
    expect(byId('custom-b')).toMatchObject({ roasterId: 2 });
    expect(soakOf(byId('custom-b')?.profile)).toEqual({ on: 'time', afterS: 90 });
    expect(byId('custom-c')?.profile).toEqual(NO_SOAK);
    expect(profiles.active().id).toBe('light-steps');
  });

  it('leaves the built-ins alone', async () => {
    const { store, profiles } = setup([NO_SOAK]);
    expect(await setOwnSoaks(90, { store, profiles })).toEqual(ok(0));
    const builtIn = (await profiles.list()).find((e) => e.profile.id === 'light-steps');
    expect(soakOf(builtIn?.profile)).toEqual({ on: 'time', afterS: 60 });
  });

  it('says so when storage fails', async () => {
    const { store, profiles } = setup([MINE], true);
    expect(await setOwnSoaks(90, { store, profiles })).toEqual(
      err({ kind: 'storage-failed', message: 'full' }),
    );
    const unreadable = {
      list: () => Promise.resolve(err({ kind: 'storage-failed' as const, message: 'gone' })),
    };
    expect(await setOwnSoaks(90, { store: unreadable, profiles })).toEqual(
      err({ kind: 'storage-failed', message: 'gone' }),
    );
  });
});
