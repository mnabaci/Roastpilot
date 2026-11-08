import { READY_ROAST, type RoastPhase, type RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { PreheatHoldPicker } from './preheat-hold-picker';

const TUNING = { holdS: 150, nextHoldS: 120 };
const START = Date.parse('2026-11-08T10:00:00.000Z');

function setup(roasterId = 1) {
  let now = START;
  const choice = new PreheatHoldPicker({
    activeRoaster: () => ({ id: roasterId, tuning: TUNING }),
    nowMs: () => now,
  });
  const phase = (p: RoastPhase) => {
    choice.onRoastChange({ ...READY_ROAST, phase: p });
  };
  return {
    choice,
    phase,
    wait: (ms: number) => {
      now += ms;
    },
  };
}

const saved = (endedAt: string, roasterId = 1) =>
  ({ roasterId, startedAt: '2026-11-08T09:30:00.000Z', endedAt, dropTimeS: 600 }) as RoastSummary;

describe('PreheatHoldPicker', () => {
  it("holds the first batch's time with no roast before", () => {
    expect(setup().choice.current()).toEqual({ s: 150, batch: 'first' });
  });

  it("after a roast in this session, holds the next batch's time for 20 min, then the first's", () => {
    const { choice, phase, wait } = setup();
    phase('preheat');
    phase('roasting');
    phase('cooling');
    phase('done');
    wait(20 * 60_000);
    expect(choice.current().batch).toBe('next');
    wait(1);
    expect(choice.current().batch).toBe('first');
  });

  it("after a restart, reads the last roast's end from the saved roasts", () => {
    const { choice } = setup();
    choice.load([saved('2026-11-08T09:50:00.000Z'), saved('2026-11-08T09:59:00.000Z', 2)]);
    expect(choice.current()).toEqual({ s: 120, batch: 'next' });
    const other = setup(3);
    other.choice.load([saved('2026-11-08T09:50:00.000Z')]);
    expect(other.choice.current().batch).toBe('first');
  });

  it('a stopped preheat is not a roast: the drum is not counted as soaked', () => {
    const { choice, phase } = setup();
    phase('preheat');
    phase('ready');
    expect(choice.current().batch).toBe('first');
  });
});
