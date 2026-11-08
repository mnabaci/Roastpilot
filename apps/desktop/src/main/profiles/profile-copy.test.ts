import type { AutoProfile } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { freeName, planCopy } from './profile-copy';

const profile = (id: string, name: string, extra: Partial<AutoProfile> = {}) =>
  ({ id, name, ...extra }) as AutoProfile;
const SOURCE = profile('custom-a', 'Light · Steps');

describe('freeName', () => {
  it('keeps a free name and numbers a taken one from 2', () => {
    expect(freeName('Mine', new Set())).toBe('Mine');
    expect(freeName('Mine', new Set(['Mine', 'Mine 2']))).toBe('Mine 3');
  });
});

describe('planCopy', () => {
  it('names the copy after the roaster it came from', () => {
    expect(planCopy(SOURCE, [], [], 'Simulator')).toEqual({
      kind: 'name',
      name: 'Light · Steps (from Simulator)',
    });
  });

  it('keeps clear of the names already there, built-ins included', () => {
    const builtIn = profile('light-steps', 'Light · Steps');
    expect(planCopy(SOURCE, [], [builtIn], undefined)).toEqual({
      kind: 'name',
      name: 'Light · Steps 2',
    });
  });

  it('finds an earlier copy instead of making a second', () => {
    const earlier = profile('custom-b', 'Copy', {
      source: { kind: 'profile', profileId: 'custom-a' },
    });
    expect(planCopy(SOURCE, [earlier], [], 'Simulator')).toEqual({
      kind: 'already-copied',
      profile: earlier,
    });
  });
});
