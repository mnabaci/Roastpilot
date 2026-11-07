import { describe, expect, it } from 'vitest';
import {
  ROASTER_COOL_AFTER_DROP_MAX_MS,
  ROASTER_COOL_MAX_MS,
  roasterCooldownCheck,
} from './roaster-cooldown';

const check = (nowMs: number, bt: number | undefined, toC: number, maxMs = ROASTER_COOL_MAX_MS) =>
  roasterCooldownCheck(0, nowMs, bt, toC, maxMs);

describe('roasterCooldownCheck', () => {
  it('runs until BT is below the target', () => {
    expect(check(60_000, 92, 50)).toBe('running');
    expect(check(60_000, 50, 50)).toBe('running');
    expect(check(60_000, 49.9, 50)).toBe('cooled');
    expect(check(60_000, 65, 70)).toBe('cooled');
  });

  it('keeps running with no reading, and gives up at its cap whatever BT says', () => {
    expect(check(60_000, undefined, 50)).toBe('running');
    expect(check(ROASTER_COOL_MAX_MS, 80, 50)).toBe('gave-up');
    expect(check(ROASTER_COOL_MAX_MS, 40, 50)).toBe('gave-up');
    const afterDrop = ROASTER_COOL_AFTER_DROP_MAX_MS;
    expect(check(afterDrop - 1, 90, 50, afterDrop)).toBe('running');
    expect(check(afterDrop, 90, 50, afterDrop)).toBe('gave-up');
  });
});
