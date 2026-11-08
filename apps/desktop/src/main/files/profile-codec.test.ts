import { silentLogger, type ProfileRepository } from '@roastpilot/core';
import { BUILT_IN_ROASTERS, SKYWALKER_PROFILES } from '@roastpilot/drivers';
import { err, ok, tempInText, type AutoProfile, type Roaster } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ProfileService } from '../profiles/profile-service';
import { exported, filesOf, without } from './codec-test-kit';
import { profileCodec } from './profile-codec';

const MINE: AutoProfile = {
  ...SKYWALKER_PROFILES['light-curve'],
  id: 'custom-mine',
  name: 'Mine',
  needsCalibration: false,
  source: { kind: 'profile', profileId: 'light-curve' },
};

const [SKYWALKER] = BUILT_IN_ROASTERS as [Roaster];

/** A real ProfileService on an in-memory store, on roaster 1 with `limits`. */
function setup(own: AutoProfile[] = [], limits: Partial<Roaster> = {}, saveFails = false) {
  let stored = own.map((profile) => ({ profile, roasterId: 1 }));
  let active: Partial<Roaster> = limits;
  const store: ProfileRepository = {
    list: () => Promise.resolve(ok(stored)),
    save: () => Promise.resolve(ok(undefined)),
    saveAll: (list, roasterId) => {
      if (saveFails) return Promise.resolve(err({ kind: 'storage-failed', message: 'full' }));
      stored = [...stored, ...list.map((profile) => ({ profile, roasterId }))];
      return Promise.resolve(ok(undefined));
    },
    deleteMany: () => Promise.resolve(ok(0)),
  };
  const profiles = new ProfileService({
    store,
    newId: () => 'unused',
    chosenId: () => 'light-steps',
    activeRoaster: () => ({ id: 1, model: 'skywalker' }),
    roaster: () => ({ name: 'Skywalker', model: 'skywalker' }),
    logger: silentLogger,
  });
  let n = 0;
  const codec = profileCodec({
    profiles,
    activeRoaster: () => ({ ...SKYWALKER, ...active }),
    newId: () => `custom-new-${String(++n)}`,
  });
  const switchTo = (roaster: Partial<Roaster>) => {
    active = roaster;
  };
  return { codec, stored: () => stored.map((s) => s.profile), switchTo };
}

const fileOf = (profiles: unknown[]) =>
  JSON.stringify({ format: 'roastpilot-profiles', version: 1, exportedAt: '', profiles });

describe('profile files', () => {
  it('carry the profile in full, without its id, roaster or source', async () => {
    const text = await exported('profiles', setup([MINE]).codec, ['custom-mine']);
    const carried = without(MINE, 'id', 'source');
    expect(JSON.parse(text)).toMatchObject({ format: 'roastpilot-profiles', profiles: [carried] });
    expect(text).not.toContain('custom-mine');
  });

  it('export all: the built-ins and your own on the active roaster', async () => {
    const text = await exported('profiles', setup([MINE]).codec);
    const names = (JSON.parse(text) as { profiles: { name: string }[] }).profiles.map(
      (p) => p.name,
    );
    expect(names).toEqual([
      SKYWALKER_PROFILES['light-steps'].name,
      SKYWALKER_PROFILES['light-curve'].name,
      'Mine',
    ]);
  });

  it('round trip: comes in on the active roaster with a new id, needing calibration', async () => {
    const text = await exported('profiles', setup([MINE]).codec, ['custom-mine']);
    const { codec, stored } = setup();
    expect(await filesOf('profiles', codec).importFile(text)).toEqual(
      ok({ added: 1, skipped: 0, archived: 0, newestId: 'custom-new-1' }),
    );
    const rest = without(MINE, 'source');
    expect(stored()).toEqual([{ ...rest, id: 'custom-new-1', needsCalibration: true }]);
  });

  it('importing it again finds it already here, though it now needs calibration', async () => {
    const text = await exported('profiles', setup([MINE]).codec, ['custom-mine']);
    const { codec } = setup();
    await filesOf('profiles', codec).importFile(text);
    expect(await filesOf('profiles', codec).importFile(text)).toEqual(
      ok({ added: 0, skipped: 1, archived: 0, newestId: null }),
    );
  });

  it('a built-in from the file is already here', async () => {
    const text = await exported('profiles', setup().codec, ['light-steps']);
    expect(await filesOf('profiles', setup().codec).importFile(text)).toEqual(
      ok({ added: 0, skipped: 1, archived: 0, newestId: null }),
    );
  });

  it('a changed one of the same name comes in as "(imported)"', async () => {
    const text = await exported('profiles', setup([{ ...MINE, devTimeS: 120 }]).codec, [
      'custom-mine',
    ]);
    const { codec, stored } = setup([MINE]);
    await filesOf('profiles', codec).importFile(text);
    expect(stored().map((p) => p.name)).toEqual(['Mine', 'Mine (imported)']);
  });

  it('refuses a profile that fails the checks Save makes', async () => {
    const bad = without({ ...MINE, capC: 250 }, 'id');
    expect(await filesOf('profiles', setup().codec).importFile(fileOf([bad]))).toEqual(
      err({ kind: 'bad-item', name: 'Mine', reason: `BT cap: At most ${tempInText(235)}` }),
    );
  });

  it("refuses a profile beyond the active roaster's limits", async () => {
    const text = await exported('profiles', setup([MINE]).codec, ['custom-mine']);
    const low = setup([], { maxTempC: MINE.capC - 5 });
    expect(await filesOf('profiles', low.codec).importFile(text)).toEqual(
      err({
        kind: 'bad-item',
        name: 'Mine',
        reason: `BT cap ${tempInText(MINE.capC)} is above this roaster's ${tempInText(MINE.capC - 5)}`,
      }),
    );
    const short = setup([], { maxTimeS: 5 * 60 });
    expect(await filesOf('profiles', short.codec).importFile(text)).toEqual(
      err({ kind: 'bad-item', name: 'Mine', reason: "Runs past this roaster's 5 min limit" }),
    );
    expect(low.stored()).toEqual([]);
  });

  it('checks against the roaster active at import time, after a switch', async () => {
    const text = await exported('profiles', setup([MINE]).codec, ['custom-mine']);
    const here = setup();
    here.switchTo({ maxTempC: MINE.capC - 5 });
    const refused = await filesOf('profiles', here.codec).importFile(text);
    expect(refused.ok ? undefined : refused.error.kind).toBe('bad-item');
    here.switchTo({});
    expect((await filesOf('profiles', here.codec).importFile(text)).ok).toBe(true);
  });

  it('says storage failed when the profiles cannot be saved, adding none', async () => {
    const text = await exported('profiles', setup([MINE]).codec, ['custom-mine']);
    const failing = setup([], {}, true);
    expect(await filesOf('profiles', failing.codec).importFile(text)).toEqual(
      err({ kind: 'storage-failed', message: 'full' }),
    );
    expect(failing.stored()).toEqual([]);
  });

  it("exports a stored profile that breaks today's rules, rather than throw", async () => {
    const old: AutoProfile = { ...MINE, capC: 250 };
    const text = await exported('profiles', setup([old]).codec, ['custom-mine']);
    expect(JSON.parse(text)).toMatchObject({ profiles: [{ name: 'Mine', capC: 250 }] });
  });
});
