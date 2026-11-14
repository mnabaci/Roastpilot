import { READY_ROAST } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { wiringStatus, wiringWait } from './wiring-status';

const roasting = { ...READY_ROAST, phase: 'roasting' as const };
const drumCooling = { ...READY_ROAST, phase: 'done' as const, roasterCoolingSinceMs: 1 };

describe('wiringStatus', () => {
  it('says picks save, and reconnect when connected', () => {
    expect(wiringStatus(wiringWait(READY_ROAST, undefined), false)).toBe('Saves as you pick');
    expect(wiringStatus(wiringWait(READY_ROAST, undefined), true)).toBe(
      'Saves as you pick · reconnects the roaster',
    );
  });

  it('says what it waits for, and on whose roaster', () => {
    expect(wiringStatus(wiringWait(roasting, undefined), true)).toBe('Waits until the roast ends');
    expect(wiringStatus(wiringWait(roasting, 'Simulator'), false)).toBe(
      "Waits until Simulator's roast ends",
    );
    expect(wiringStatus(wiringWait(drumCooling, undefined), true)).toBe(
      'Waits until the drum has cooled',
    );
  });
});
