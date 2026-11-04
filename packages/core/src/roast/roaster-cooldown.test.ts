import { describe, expect, it } from 'vitest';
import { ROASTER_COOL_MAX_MS, roasterCooldownCheck } from './roaster-cooldown';

describe('roasterCooldownCheck', () => {
  it('runs until BT is below 50 °C', () => {
    expect(roasterCooldownCheck(0, 60_000, 92)).toBe('running');
    expect(roasterCooldownCheck(0, 60_000, 50)).toBe('running');
    expect(roasterCooldownCheck(0, 60_000, 49.9)).toBe('cooled');
  });

  it('keeps running with no reading, and gives up after 15 min whatever BT says', () => {
    expect(roasterCooldownCheck(0, 60_000, undefined)).toBe('running');
    expect(roasterCooldownCheck(0, ROASTER_COOL_MAX_MS, 80)).toBe('gave-up');
    expect(roasterCooldownCheck(0, ROASTER_COOL_MAX_MS, 40)).toBe('gave-up');
  });
});
