import { silentLogger } from '@roastpilot/core';
import { ok, type BeanFields } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { BeanService } from '../beans/bean-service';
import { ProfileService } from '../profiles/profile-service';
import { RoasterService } from '../roasters/roaster-service';
import { openStores } from '../storage-wiring';
import { systemClock } from '../system-clock';
import { createLibraryKinds } from './library-wiring';

const GUJI: BeanFields = {
  name: 'Ethiopia Guji',
  origin: 'Ethiopia',
  process: 'washed',
  species: null,
  variety: null,
  altitudeM: 2100,
  densityGL: null,
  moisturePct: null,
  screen: null,
  decaf: false,
  supplier: null,
  link: null,
  lowStockG: 500,
  notes: null,
};

/** One computer: a real database in memory, the real services and the registered kinds. */
async function computer() {
  const stores = openStores(':memory:', systemClock, silentLogger);
  const roasters = new RoasterService({
    repository: stores.roasterStore,
    inUse: () => false,
    onChange: () => undefined,
    logger: silentLogger,
  });
  await roasters.load();
  let n = 0;
  const profiles = new ProfileService({
    store: stores.profileStore,
    newId: () => `custom-${String(++n)}`,
    chosenId: () => 'light-steps',
    onChange: () => undefined,
    activeRoaster: () => roasters.active(),
    roaster: (id) => roasters.all.find((r) => r.id === id),
    logger: silentLogger,
  });
  const beans = new BeanService({
    repository: stores.beanStore,
    onChange: () => undefined,
    logger: silentLogger,
  });
  const kinds = createLibraryKinds({
    beans,
    profiles,
    profileStore: stores.profileStore,
    roasters,
    newProfileId: () => `custom-in-${String(++n)}`,
    now: () => new Date('2026-11-08T10:00:00.000Z'),
    logger: silentLogger,
  });
  return { stores, roasters, profiles, beans, kinds };
}

const textOf = (result: { ok: boolean; value?: string }) => {
  if (!result.ok || result.value === undefined) throw new Error('export failed');
  return result.value;
};

describe('Roastpilot files between two computers, on real storage', () => {
  it('a profile, a bean and a roaster go across; again is skipped; changed is renamed', async () => {
    const mine = await computer();
    const copy = await mine.profiles.duplicate('light-curve', 'Guji light');
    if (!copy.ok) throw new Error('no copy');
    const beanId = await mine.beans.add(GUJI);
    if (!beanId.ok) throw new Error('no bean');
    await mine.beans.update({ id: beanId.value, fields: GUJI, profileId: copy.value.profile.id });
    const profileFile = textOf(await mine.kinds.profiles.exportFile([copy.value.profile.id]));
    const beanFile = textOf(await mine.kinds.beans.exportFile([beanId.value]));
    const roasterFile = textOf(await mine.kinds.roasters.exportFile([1]));

    const friend = await computer();
    expect(await friend.kinds.profiles.importFile(profileFile)).toEqual(
      ok({ added: 1, skipped: 0, archived: 0, newestId: 'custom-in-1' }),
    );
    expect(await friend.kinds.beans.importFile(beanFile)).toEqual(
      ok({ added: 1, skipped: 0, archived: 0, newestId: 1 }),
    );
    const [bean] = await friend.beans.list();
    // Linked by name to the profile that just came in; no stock, not archived.
    expect(bean).toMatchObject({ profileId: 'custom-in-1', greenG: 0, archived: false });
    const imported = (await friend.profiles.list()).find((e) => e.profile.name === 'Guji light');
    expect(imported?.profile.needsCalibration).toBe(true);

    // The same files again: everything already here.
    expect(await friend.kinds.profiles.importFile(profileFile)).toEqual(
      ok({ added: 0, skipped: 1, archived: 0, newestId: null }),
    );
    expect(await friend.kinds.beans.importFile(beanFile)).toEqual(
      ok({ added: 0, skipped: 1, archived: 0, newestId: null }),
    );
    // Their Skywalker is the same record as the friend's own.
    expect(await friend.kinds.roasters.importFile(roasterFile)).toEqual(
      ok({ added: 0, skipped: 1, archived: 0, newestId: null }),
    );

    // Changed at home, then sent again: comes in beside, nothing overwritten.
    await mine.roasters.save({ ...mine.roasters.active(), tempOffsetC: -4 });
    const changed = textOf(await mine.kinds.roasters.exportFile([1]));
    expect(await friend.kinds.roasters.importFile(changed)).toEqual(
      ok({ added: 1, skipped: 0, archived: 0, newestId: 3 }),
    );
    expect(friend.roasters.all.map((r) => [r.name, r.active, r.connection])).toEqual([
      ['Skywalker', true, null],
      ['Simulator', false, { kind: 'simulator' }],
      ['Skywalker (imported)', false, null],
    ]);
    const reloaded = await friend.stores.roasterStore.list();
    expect(reloaded.ok && reloaded.value.map((r) => r.name)).toContain('Skywalker (imported)');

    // A beans file on Profiles is refused by name.
    expect(await friend.kinds.profiles.importFile(beanFile)).toEqual({
      ok: false,
      error: { kind: 'wrong-kind', fileKind: 'beans' },
    });
    friend.stores.close();
    mine.stores.close();
  });
});
