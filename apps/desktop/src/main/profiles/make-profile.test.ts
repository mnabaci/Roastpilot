import { err, ok, type AutoProfile, type RoastDetail, type SavedSample } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { makeProfileFromRoast } from './make-profile';

const samples: SavedSample[] = Array.from({ length: 300 }, (_, i) => ({
  tS: i * 2,
  values: { bt: 100 + i / 3, heater: 60, fan: 40 },
}));

const roast = {
  id: 3,
  roasterId: 2,
  fcTimeS: 500,
  dropTimeS: 590,
  batchG: 300,
  profile: null,
  samples,
  events: [],
} as unknown as RoastDetail;

function deps(read = Promise.resolve(ok(roast))) {
  const addOn = vi.fn((profile: AutoProfile) => Promise.resolve(ok({ profile, builtIn: false })));
  return {
    addOn,
    deps: {
      history: { get: () => read },
      profiles: { addOn },
      activeRoaster: () => ({ id: 1, batchIdealG: 385 }),
      newId: () => 'custom-1',
    },
  } as never;
}

describe('makeProfileFromRoast', () => {
  const request = { roastId: 3, style: 'steps' } as const;

  it('saves the new profile on the roaster the roast ran on', async () => {
    const { deps: all, addOn } = deps() as { deps: never; addOn: ReturnType<typeof vi.fn> };
    const made = await makeProfileFromRoast(request, all);
    expect(made.ok).toBe(true);
    expect(addOn).toHaveBeenCalledWith(expect.objectContaining({ id: 'custom-1' }), 2);
  });

  it('says when the roast has too little to go on', async () => {
    const short = { ...roast, dropTimeS: null };
    const { deps: all } = deps(Promise.resolve(ok(short))) as { deps: never };
    expect(await makeProfileFromRoast(request, all)).toEqual(err({ kind: 'too-short' }));
  });

  it('passes on a roast it could not read', async () => {
    const missing = err({ kind: 'not-found' as const, id: 3 });
    const { deps: all } = deps(Promise.resolve(missing) as never) as { deps: never };
    expect(await makeProfileFromRoast(request, all)).toEqual(missing);
  });
});
