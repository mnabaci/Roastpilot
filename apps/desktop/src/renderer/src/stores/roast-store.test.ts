import { MAX_HISTORY_READINGS } from '@roastpilot/core';
import { describe, expect, it } from 'vitest';
import { READY_ROAST } from '@roastpilot/shared';
import { addReading, setRoast, type RoastData } from './roast-store';

const reading = (atMs: number) => ({ atMs, values: { bt: 100 } });
const empty: RoastData = { roast: READY_ROAST, readings: [] };

describe('roast store', () => {
  it('keeps at most the history main keeps', () => {
    let data: RoastData = {
      ...empty,
      readings: Array.from({ length: MAX_HISTORY_READINGS }, (_, i) => reading(i)),
    };
    data = addReading(data, reading(MAX_HISTORY_READINGS));
    expect(data.readings).toHaveLength(MAX_HISTORY_READINGS);
    expect(data.readings[0]?.atMs).toBe(1);
    expect(data.readings.at(-1)?.atMs).toBe(MAX_HISTORY_READINGS);
  });

  it('Preheat starts a new roast and drops the old readings; other changes keep them', () => {
    const preheat = setRoast(
      { ...empty, readings: [reading(1)] },
      { ...READY_ROAST, phase: 'preheat' },
    );
    expect(preheat.readings).toEqual([]);
    const charged = setRoast(
      { ...preheat, readings: [reading(2)] },
      { ...READY_ROAST, phase: 'roasting' },
    );
    expect(charged.readings).toEqual([reading(2)]);
  });
});
