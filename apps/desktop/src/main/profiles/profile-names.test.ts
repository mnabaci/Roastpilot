import { SKYWALKER_PROFILES } from '@roastpilot/drivers';
import { err, ok, type AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { allProfileNames } from './profile-names';

const MINE: AutoProfile = { ...SKYWALKER_PROFILES['light-steps'], id: 'custom-a', name: 'Mine' };

describe('allProfileNames', () => {
  it('names every profile by id: the built-ins of every model, your own on any roaster', async () => {
    const names = await allProfileNames({
      list: () => Promise.resolve(ok([{ profile: MINE, roasterId: 7 }])),
    });
    expect(names.ok && names.value.get('custom-a')).toBe('Mine');
    expect(names.ok && names.value.get('light-steps')).toBe(SKYWALKER_PROFILES['light-steps'].name);
  });

  it('says storage failed rather than leave your names out', async () => {
    const failure = err({ kind: 'storage-failed' as const, message: 'locked' });
    expect(await allProfileNames({ list: () => Promise.resolve(failure) })).toEqual(failure);
  });
});
