import { describe, expect, it } from 'vitest';
import { isRoastRunning, READY_ROAST, type RoastPhase } from './roast';

describe('isRoastRunning', () => {
  it.each<[RoastPhase, boolean]>([
    ['ready', false],
    ['preheat', true],
    ['roasting', true],
    ['development', true],
    ['cooling', true],
    ['done', false],
  ])('%s: %s', (phase, running) => {
    expect(isRoastRunning({ ...READY_ROAST, phase })).toBe(running);
  });

  it('drum cooling counts as running, in Ready or Done', () => {
    for (const phase of ['ready', 'done'] as const) {
      expect(
        isRoastRunning({
          ...READY_ROAST,
          phase,
          roasterCoolingSinceMs: 1_000,
          roasterCoolToC: 50,
        }),
      ).toBe(true);
    }
  });
});
