import { createLogger } from '@roastpilot/core';
import {
  err,
  ok,
  PROFILE_SCHEMA_VERSION,
  type AutoProfile,
  type Bean,
  type LogEntry,
  type ProfileEntry,
  type RoastDetail,
  type StorageError,
} from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { makeTasteProfile, type MakeTasteProfileDeps } from './make-taste-profile';

const PROFILE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'light-steps',
  name: 'Light · Steps',
  needsCalibration: false,
  batchG: 350,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 105,
  capC: 215,
  curve: [
    { tS: 0, c: 180 },
    { tS: 660, c: 210 },
  ],
  phases: [{ name: 'Roast', heat: { mode: 'fixed', pct: 60 }, fanPct: 30, next: { on: 'end' } }],
};

/** An Auto roast tasted sour: 1:45 development, 16.3 %, so it suggests +15 s. */
const ROAST: RoastDetail = {
  id: 12,
  startedAt: '2026-11-20T10:00:00.000Z',
  endedAt: '2026-11-20T10:15:00.000Z',
  fcTimeS: 540,
  fcTemp: 196,
  dropTimeS: 645,
  dropTemp: 208,
  roasterId: 3,
  beanId: 1,
  ghostRoastId: null,
  batchG: 350,
  roastedG: 300,
  rating: 3,
  isFavourite: false,
  notes: null,
  profileId: PROFILE.id,
  profileName: PROFILE.name,
  imported: false,
  tasteTags: ['sour'],
  tasteWords: 'tart',
  mode: 'auto',
  profile: PROFILE,
  samples: [],
  events: [],
};

const BEAN = { id: 1, name: 'Guji Natural' } as Bean;
const FAILED = err({ kind: 'storage-failed' as const, message: 'disk full' });
const entryOf = (profile: AutoProfile): ProfileEntry => ({ profile, builtIn: false });

function setup({
  roast = ROAST,
  taken = new Set<string>(),
  added = (profile: AutoProfile) => Promise.resolve(ok(entryOf(profile))),
  link = () => Promise.resolve(ok(undefined)),
  remove = () => Promise.resolve(ok(undefined)),
}: {
  roast?: RoastDetail | 'missing';
  taken?: ReadonlySet<string>;
  added?: (profile: AutoProfile) => Promise<ReturnType<typeof ok<ProfileEntry>> | typeof FAILED>;
  link?: () => Promise<ReturnType<typeof ok<undefined>> | typeof FAILED>;
  remove?: () => Promise<ReturnType<typeof ok<undefined>> | typeof FAILED>;
} = {}) {
  const entries: LogEntry[] = [];
  const deps = {
    history: {
      get: vi.fn((id: number) =>
        Promise.resolve(
          roast === 'missing' ? err<StorageError>({ kind: 'not-found', id }) : ok(roast),
        ),
      ),
    },
    profiles: {
      addOn: vi.fn((profile: AutoProfile, _roasterId: number) => added(profile)),
      delete: vi.fn(remove),
      ownNames: vi.fn(() => taken),
    },
    beans: {
      find: vi.fn((id: number) =>
        Promise.resolve(id === BEAN.id ? ok(BEAN) : err<StorageError>({ kind: 'not-found', id })),
      ),
      linkProfile: vi.fn(link),
    },
    activeRoaster: () => ({ id: 9 }),
    newId: () => 'custom-taste',
    logger: createLogger({ write: (e) => entries.push(e) }, 'history'),
  };
  return { deps: deps as unknown as MakeTasteProfileDeps, mocks: deps, entries };
}

describe('makeTasteProfile', () => {
  it('makes the profile with the one change, on the roast’s roaster, the bean’s own', async () => {
    const { deps, mocks, entries } = setup();
    const made = await makeTasteProfile({ roastId: 12 }, deps);
    const expected: AutoProfile = {
      ...PROFILE,
      devTimeS: 120,
      id: 'custom-taste',
      name: 'Guji Natural',
      source: { kind: 'roast', roastId: 12 },
    };
    expect(made).toEqual(ok(entryOf(expected)));
    expect(mocks.profiles.addOn).toHaveBeenCalledWith(expected, 3);
    expect(mocks.beans.linkProfile).toHaveBeenCalledWith(BEAN, 'custom-taste');
    expect(entries.map((e) => e.event)).toEqual(['history.taste-profile-made']);
    expect(ROAST.profile?.devTimeS).toBe(105);
  });

  it('names it apart from your profiles on that roaster', async () => {
    const { deps, mocks } = setup({ taken: new Set(['Guji Natural', 'Guji Natural 2']) });
    await makeTasteProfile({ roastId: 12 }, deps);
    expect(mocks.profiles.ownNames).toHaveBeenCalledWith(3);
    expect(mocks.profiles.addOn.mock.calls[0]?.[0].name).toBe('Guji Natural 3');
  });

  it('without a bean, names it after the profile and links nothing', async () => {
    const { deps, mocks } = setup({ roast: { ...ROAST, beanId: null } });
    expect(await makeTasteProfile({ roastId: 12 }, deps)).toMatchObject({ ok: true });
    expect(mocks.profiles.addOn.mock.calls[0]?.[0].name).toBe('Light · Steps · tasted');
    expect(mocks.beans.linkProfile).not.toHaveBeenCalled();
  });

  it('puts it on the active roaster when the roast has none', async () => {
    const { deps, mocks } = setup({ roast: { ...ROAST, roasterId: null } });
    await makeTasteProfile({ roastId: 12 }, deps);
    expect(mocks.profiles.addOn.mock.calls[0]?.[1]).toBe(9);
  });

  it('says not found for a roast that is gone', async () => {
    const { deps } = setup({ roast: 'missing' });
    expect(await makeTasteProfile({ roastId: 12 }, deps)).toEqual(
      err({ kind: 'not-found', id: 12 }),
    );
  });

  it.each([
    ['no tags', { tasteTags: [] }],
    ['sweet and balanced', { tasteTags: ['balanced' as const] }],
    ['a manual roast', { mode: 'manual' as const }],
    ['a change past the limits', { profile: { ...PROFILE, devTimeS: 600 } }],
  ])('makes nothing when the taste suggests no change: %s', async (_name, over) => {
    const { deps, mocks } = setup({ roast: { ...ROAST, ...over } });
    expect(await makeTasteProfile({ roastId: 12 }, deps)).toEqual(err({ kind: 'no-change' }));
    expect(mocks.profiles.addOn).not.toHaveBeenCalled();
  });

  it('makes nothing for a bean that is gone', async () => {
    const { deps, mocks } = setup({ roast: { ...ROAST, beanId: 44 } });
    expect(await makeTasteProfile({ roastId: 12 }, deps)).toEqual(
      err({ kind: 'bean-not-found', id: 44 }),
    );
    expect(mocks.profiles.addOn).not.toHaveBeenCalled();
  });

  it('says why when the profile cannot be saved', async () => {
    const { deps, mocks } = setup({ added: () => Promise.resolve(FAILED) });
    expect(await makeTasteProfile({ roastId: 12 }, deps)).toEqual(
      err({ kind: 'storage-failed', message: 'disk full' }),
    );
    expect(mocks.beans.linkProfile).not.toHaveBeenCalled();
  });

  it('deletes the new profile when linking it fails', async () => {
    const { deps, mocks, entries } = setup({ link: () => Promise.resolve(FAILED) });
    expect(await makeTasteProfile({ roastId: 12 }, deps)).toEqual(
      err({ kind: 'storage-failed', message: 'disk full' }),
    );
    expect(mocks.profiles.delete).toHaveBeenCalledWith('custom-taste');
    expect(entries.map((e) => e.event)).toEqual(['history.taste-profile-undone']);
  });

  it('logs a delete that fails too, and still says why', async () => {
    const { deps, entries } = setup({
      link: () => Promise.resolve(FAILED),
      remove: () => Promise.resolve(FAILED),
    });
    expect((await makeTasteProfile({ roastId: 12 }, deps)).ok).toBe(false);
    expect(entries.map((e) => e.event)).toEqual(['history.taste-profile-undo-failed']);
  });

  it('deletes the new profile when linking throws, then throws on', async () => {
    const { deps, mocks } = setup({ link: () => Promise.reject(new Error('bug')) });
    await expect(makeTasteProfile({ roastId: 12 }, deps)).rejects.toThrow('bug');
    expect(mocks.profiles.delete).toHaveBeenCalledWith('custom-taste');
  });
});
