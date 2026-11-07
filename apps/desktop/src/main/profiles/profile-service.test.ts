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
    activeRoaster: () => ({ id: roasterId, model: 'skywalker' }),
    logger: silentLogger,
  });
  return {
    service,
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
