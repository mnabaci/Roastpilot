import { createLogger, silentLogger, type ProfileRepository } from '@roastpilot/core';
import { err, ok, type Bean, type LogEntry, type StorageError } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from '../profiles/profile-service';
import { makeBeanProfile, type MakeBeanProfileDeps } from './make-bean-profile';

const BEAN = { id: 1, name: 'Yirgacheffe' } as Bean;
const FAILED = err({ kind: 'storage-failed' as const, message: 'disk full' });

/** A real ProfileService on an in-memory store, and beans that link as `link` says. */
function setup({
  link = () => Promise.resolve(ok(undefined)),
  deleteFails = false,
}: {
  link?: MakeBeanProfileDeps['beans']['linkProfile'];
  deleteFails?: boolean;
} = {}) {
  let stored: string[] = [];
  const names = new Map<string, string>();
  const store: ProfileRepository = {
    list: () => Promise.resolve(ok([])),
    save: (profile) => {
      stored = [...stored.filter((id) => id !== profile.id), profile.id];
      names.set(profile.id, profile.name);
      return Promise.resolve(ok(undefined));
    },
    saveAll: () => Promise.resolve(ok(undefined)),
    deleteMany: (ids) => {
      if (deleteFails) return Promise.resolve(FAILED);
      const had = stored.filter((s) => ids.includes(s)).length;
      stored = stored.filter((s) => !ids.includes(s));
      return Promise.resolve(ok(had));
    },
  };
  const profiles = new ProfileService({
    store,
    newId: () => 'custom-new',
    chosenId: () => 'light-steps',
    onChange: () => undefined,
    activeRoaster: () => ({ id: 1, model: 'skywalker' }),
    roaster: () => ({ name: 'Skywalker', model: 'skywalker' }),
    logger: silentLogger,
  });
  const entries: LogEntry[] = [];
  const beans = {
    find: vi.fn((id: number) =>
      Promise.resolve(id === BEAN.id ? ok(BEAN) : err<StorageError>({ kind: 'not-found', id })),
    ),
    linkProfile: vi.fn(link),
  };
  const deps: MakeBeanProfileDeps = {
    beans,
    profiles,
    logger: createLogger({ write: (e) => entries.push(e) }, 'beans'),
  };
  return { deps, beans, stored: () => stored, names, entries };
}

describe('makeBeanProfile', () => {
  it('copies the profile under the bean name, links it and returns it', async () => {
    const { deps, beans, stored, names } = setup();
    const made = await makeBeanProfile({ beanId: 1, profileId: 'light-steps' }, deps);
    expect(made).toMatchObject({
      ok: true,
      value: { builtIn: false, profile: { id: 'custom-new', name: 'Yirgacheffe' } },
    });
    expect(stored()).toEqual(['custom-new']);
    expect(names.get('custom-new')).toBe('Yirgacheffe');
    expect(beans.linkProfile).toHaveBeenCalledWith(BEAN, 'custom-new');
  });

  it('makes nothing for a bean that is not there', async () => {
    const { deps, stored } = setup();
    expect(await makeBeanProfile({ beanId: 9, profileId: 'light-steps' }, deps)).toEqual(
      err({ kind: 'bean-not-found', id: 9 }),
    );
    expect(stored()).toEqual([]);
  });

  it('makes nothing from a profile that is not there', async () => {
    const { deps, beans, stored } = setup();
    expect(await makeBeanProfile({ beanId: 1, profileId: 'nope' }, deps)).toEqual(
      err({ kind: 'profile-not-found', id: 'nope' }),
    );
    expect(stored()).toEqual([]);
    expect(beans.linkProfile).not.toHaveBeenCalled();
  });

  it('passes on beans that cannot be read', async () => {
    const { deps, beans } = setup();
    beans.find.mockResolvedValueOnce(FAILED);
    expect(await makeBeanProfile({ beanId: 1, profileId: 'light-steps' }, deps)).toEqual(FAILED);
  });

  it('deletes the copy again when the link fails, so nothing is left behind', async () => {
    const { deps, stored, entries } = setup({ link: () => Promise.resolve(FAILED) });
    expect(await makeBeanProfile({ beanId: 1, profileId: 'light-steps' }, deps)).toEqual(FAILED);
    expect(stored()).toEqual([]);
    expect(entries.map((e) => e.event)).toContain('beans.make-profile-undone');
  });

  it('deletes the copy again when the link throws, and lets the error through', async () => {
    const { deps, stored } = setup({ link: () => Promise.reject(new Error('bad row')) });
    await expect(makeBeanProfile({ beanId: 1, profileId: 'light-steps' }, deps)).rejects.toThrow(
      'bad row',
    );
    expect(stored()).toEqual([]);
  });

  it('logs a copy that cannot be deleted, and still says the make failed', async () => {
    const { deps, stored, entries } = setup({
      link: () => Promise.resolve(FAILED),
      deleteFails: true,
    });
    expect(await makeBeanProfile({ beanId: 1, profileId: 'light-steps' }, deps)).toEqual(FAILED);
    expect(stored()).toEqual(['custom-new']);
    expect(entries).toContainEqual(
      expect.objectContaining({ level: 'error', event: 'beans.make-profile-undo-failed' }),
    );
  });
});
