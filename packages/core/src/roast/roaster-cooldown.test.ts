import { describe, expect, it } from 'vitest';
import { ROASTER_COOL_MAX_MS, roasterCooldownCheck } from './roaster-cooldown';

describe('roasterCooldownCheck', () => {
  it('runs until BT is below the target', () => {
    expect(roasterCooldownCheck(0, 60_000, 92, 50)).toBe('running');
    expect(roasterCooldownCheck(0, 60_000, 50, 50)).toBe('running');
    expect(roasterCooldownCheck(0, 60_000, 49.9, 50)).toBe('cooled');
    expect(roasterCooldownCheck(0, 60_000, 65, 70)).toBe('cooled');
  });

  it('keeps running with no reading, and gives up after 15 min whatever BT says', () => {
    expect(roasterCooldownCheck(0, 60_000, undefined, 50)).toBe('running');
    expect(roasterCooldownCheck(0, ROASTER_COOL_MAX_MS, 80, 50)).toBe('gave-up');
    expect(roasterCooldownCheck(0, ROASTER_COOL_MAX_MS, 40, 50)).toBe('gave-up');
  });
});
