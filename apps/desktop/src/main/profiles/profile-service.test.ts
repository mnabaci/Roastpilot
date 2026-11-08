import { milestonesFrom, silentLogger, type ProfileRepository } from '@roastpilot/core';
import { SKYWALKER_PROFILES } from '@roastpilot/drivers';
import { err, ok, type AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ProfileService } from './profile-service';

const MINE: AutoProfile = { ...SKYWALKER_PROFILES['light-steps'], id: 'custom-a', name: 'Mine' };

function setup(start: AutoProfile[] = []) {
  let stored = [...start];
  let chosen = 'light-steps';
  let roasterId = 1;
  const owners = new Map<string, number>(start.map((p) => [p.id, 1]));
  const store: ProfileRepository = {
    list: () =>
      Promise.resolve(
        ok(stored.map((profile) => ({ profile, roasterId: owners.get(profile.id) ?? 1 }))),
      ),
    save: (profile, owner) => {
      owners.set(profile.id, owner);
      stored = [...stored.filter((p) => p.id !== profile.id), profile];
      return Promise.resolve(ok(undefined));
    },
    saveAll: (list, owner) => {
      for (const profile of list) owners.set(profile.id, owner);
      const ids = new Set(list.map((p) => p.id));
      stored = [...stored.filter((p) => !ids.has(p.id)), ...list];
      return Promise.resolve(ok(undefined));
    },
    deleteMany: (ids) => {
      const had = stored.filter((p) => ids.includes(p.id)).length;
      stored = stored.filter((p) => !ids.includes(p.id));
      return Promise.resolve(ok(had));
    },
  };
  let deleted = 0;
  const service = new ProfileService({
    store,
    newId: () => 'custom-new',
    chosenId: () => chosen,
    activeRoaster: () => ({ id: roasterId, model: 'skywalker' }),
    onDeleted: () => {
      deleted += 1;
    },
    logger: silentLogger,
  });
  return {
    service,
    deletions: () => deleted,
    stored: () => stored,
    useRoaster: (id: number) => {
      roasterId = id;
    },
    choose: (id: string) => {
      chosen = id;
    },
  };
}

describe('ProfileService', () => {
  it('adds imported profiles to the active roaster at once', async () => {
    const { service, useRoaster } = setup();
    useRoaster(2);
    const other = { ...MINE, id: 'custom-b', name: 'Other' };
    expect(await service.addAll([MINE, other])).toEqual(ok(undefined));
    const own = (await service.list()).filter((e) => !e.builtIn);
    expect(own.map((e) => e.profile.id)).toEqual(['custom-a', 'custom-b']);
    useRoaster(1);
    expect((await service.list()).filter((e) => !e.builtIn)).toEqual([]);
  });

  it('an import that fails to save says why', async () => {
    const failing: ProfileRepository = {
      list: () => Promise.resolve(ok([])),
      save: () => Promise.resolve(ok(undefined)),
      saveAll: () => Promise.resolve(err({ kind: 'storage-failed', message: 'full' })),
      deleteMany: () => Promise.resolve(ok(0)),
    };
    const service = new ProfileService({
      store: failing,
      newId: () => 'x',
      chosenId: () => 'light-steps',
      activeRoaster: () => ({ id: 1, model: 'skywalker' }),
      logger: silentLogger,
    });
    expect(await service.addAll([MINE])).toEqual(err({ kind: 'storage-failed', message: 'full' }));
    expect((await service.list()).filter((e) => !e.builtIn)).toEqual([]);
  });

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
      saveAll: () => Promise.resolve(err({ kind: 'storage-failed', message: 'gone' })),
      deleteMany: () => Promise.resolve(err({ kind: 'storage-failed', message: 'gone' })),
    };
    const service = new ProfileService({
      store: failing,
      newId: () => 'x',
      chosenId: () => 'light-steps',
      activeRoaster: () => ({ id: 1, model: 'skywalker' }),
      logger: silentLogger,
    });
    expect(await service.list()).toHaveLength(2);
    expect(await service.duplicate('light-steps')).toEqual({
      ok: false,
      error: { kind: 'storage-failed', message: 'gone' },
    });
    const milestones = milestonesFrom(SKYWALKER_PROFILES['light-curve']);
    expect(await service.fromMilestones(milestones)).toEqual({
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

  it('a duplicate can take its name, in the same single write', async () => {
    const { service, stored } = setup();
    const copy = await service.duplicate('light-steps', 'Yirgacheffe');
    expect(copy).toMatchObject({ ok: true, value: { profile: { name: 'Yirgacheffe' } } });
    expect(stored().map((p) => [p.id, p.name])).toEqual([['custom-new', 'Yirgacheffe']]);
  });

  it('makes a curve profile from milestones on the active roaster, named after the ones there', async () => {
    const { service, stored, useRoaster } = setup([{ ...MINE, name: 'Milestones' }]);
    await service.list();
    const milestones = milestonesFrom(SKYWALKER_PROFILES['light-curve']);
    const made = await service.fromMilestones({ ...milestones, chargeC: 190 });
    expect(made).toMatchObject({
      ok: true,
      value: { builtIn: false, profile: { id: 'custom-new', name: 'Milestones 2', chargeC: 190 } },
    });
    expect(stored().map((p) => p.id)).toEqual(['custom-a', 'custom-new']);
    useRoaster(2);
    expect(await service.fromMilestones(milestones)).toMatchObject({
      value: { profile: { name: 'Milestones' } },
    });
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

  it("runs the chosen profile, and the default when this roaster hasn't got it", async () => {
    const { service, choose, useRoaster } = setup([MINE]);
    await service.list();
    choose('custom-a');
    expect(service.active().name).toBe('Mine');
    await service.save({ ...MINE, name: 'Edited' });
    expect(service.active().name).toBe('Edited');
    // Once the chosen one isn't on this roaster, the first built-in.
    useRoaster(2);
    expect(service.active().id).toBe('light-steps');
  });

  it('deletes several of your own at once', async () => {
    const two: AutoProfile = { ...MINE, id: 'custom-b', name: 'Two' };
    const three: AutoProfile = { ...MINE, id: 'custom-c', name: 'Three' };
    const { service, stored } = setup([MINE, two, three]);
    await service.list();
    expect(await service.deleteMany(['custom-a', 'custom-b'])).toEqual(ok(undefined));
    expect(stored()).toEqual([three]);
    const own = (await service.list()).filter((e) => !e.builtIn).map((e) => e.profile.id);
    expect(own).toEqual(['custom-c']);
  });

  it('refuses to delete the profile Auto uses or is running, alone or among others', async () => {
    const two: AutoProfile = { ...MINE, id: 'custom-b', name: 'Two' };
    const { service, stored, choose } = setup([MINE, two]);
    await service.list();
    choose('custom-a');
    // The one Auto uses is the one it runs, from Preheat until Drop.
    expect(service.active().id).toBe('custom-a');
    expect(await service.delete('custom-a')).toEqual(err({ kind: 'in-use', id: 'custom-a' }));
    expect(await service.deleteMany(['custom-b', 'custom-a'])).toEqual(
      err({ kind: 'in-use', id: 'custom-a' }),
    );
    expect(stored()).toEqual([MINE, two]);
    expect(await service.delete('custom-b')).toEqual(ok(undefined));
  });

  it('says once a delete has gone through, so the beans it unlinked are read again', async () => {
    const { service, deletions } = setup([MINE]);
    await service.list();
    await service.delete('custom-a');
    expect(deletions()).toBe(1);
    await service.delete('custom-a');
    expect(deletions()).toBe(1);
  });

  it('deletes none when one is a built-in', async () => {
    const { service, stored } = setup([MINE]);
    expect(await service.deleteMany(['custom-a', 'light-steps'])).toEqual(
      err({ kind: 'built-in', id: 'light-steps' }),
    );
    expect(stored()).toEqual([MINE]);
  });

  it('keeps them all, listed, when storage fails', async () => {
    const failing: ProfileRepository = {
      list: () => Promise.resolve(ok([{ profile: MINE, roasterId: 1 }])),
      save: () => Promise.resolve(ok(undefined)),
      saveAll: () => Promise.resolve(ok(undefined)),
      deleteMany: () => Promise.resolve(err({ kind: 'storage-failed', message: 'locked' })),
    };
    const service = new ProfileService({
      store: failing,
      newId: () => 'x',
      chosenId: () => 'light-steps',
      activeRoaster: () => ({ id: 1, model: 'skywalker' }),
      logger: silentLogger,
    });
    await service.list();
    expect(await service.deleteMany(['custom-a'])).toEqual(
      err({ kind: 'storage-failed', message: 'locked' }),
    );
    expect(service.active().id).toBe('light-steps');
    expect((await service.list()).map((e) => e.profile.id)).toContain('custom-a');
  });

  it('says when there was nothing to delete', async () => {
    const { service } = setup();
    expect(await service.delete('nope')).toEqual({
      ok: false,
      error: { kind: 'not-found', id: 'nope' },
    });
  });

  it("lists only the active roaster's own, and runs its first built-in if the choice is elsewhere", async () => {
    const { service, useRoaster, choose } = setup([MINE]);
    choose('custom-a');
    await service.list();
    expect(service.active().id).toBe('custom-a');
    useRoaster(2);
    const list = await service.list();
    expect(list.map((e) => e.profile.id)).toEqual(['light-steps', 'light-curve']);
    expect(service.active().id).toBe('light-steps');
  });

  it('copies to another roaster, marked needs calibration, leaving this list alone', async () => {
    const { service } = setup([{ ...MINE, needsCalibration: false }]);
    await service.list();
    const copy = await service.copyTo('custom-a', 2);
    expect(copy).toMatchObject({
      ok: true,
      value: { profile: { id: 'custom-new', needsCalibration: true } },
    });
    expect((await service.list()).map((e) => e.profile.id)).not.toContain('custom-new');
  });

  it('saving your own keeps it on its roaster', async () => {
    const { service, useRoaster } = setup([MINE]);
    await service.list();
    useRoaster(2);
    await service.save({ ...MINE, name: 'Edited' });
    expect((await service.list()).map((e) => e.profile.id)).not.toContain('custom-a');
  });
});
