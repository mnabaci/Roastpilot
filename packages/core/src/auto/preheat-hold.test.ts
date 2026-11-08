import { describe, expect, it } from 'vitest';
import { BACK_TO_BACK_MS, lastRoastEndMs, pickPreheatHold } from './preheat-hold';

const TUNING = { holdS: 150, nextHoldS: 120 };
const NOW = Date.parse('2026-11-08T10:00:00.000Z');

describe('pickPreheatHold', () => {
  it("holds the first batch's time with no roast before", () => {
    expect(pickPreheatHold(TUNING, null, NOW)).toEqual({ s: 150, batch: 'first' });
  });

  it("holds the next batch's time up to 20 min after the last roast ended, that moment included", () => {
    expect(pickPreheatHold(TUNING, NOW - 5 * 60_000, NOW)).toEqual({ s: 120, batch: 'next' });
    expect(pickPreheatHold(TUNING, NOW - BACK_TO_BACK_MS, NOW)).toEqual({ s: 120, batch: 'next' });
  });

  it("holds the first batch's time once the drum has had more than 20 min to cool", () => {
    expect(pickPreheatHold(TUNING, NOW - BACK_TO_BACK_MS - 1, NOW)).toEqual({
      s: 150,
      batch: 'first',
    });
  });

  it('ignores a last end in the future (a clock moved back)', () => {
    expect(pickPreheatHold(TUNING, NOW + 60_000, NOW).batch).toBe('first');
  });
});

describe('lastRoastEndMs', () => {
  const roast = (
    roasterId: number | null,
    startedAt: string,
    endedAt: string | null,
    dropTimeS: number | null,
  ) => ({
    roasterId,
    startedAt,
    endedAt,
    dropTimeS,
  });

  it("is the latest cool end of this roaster's saved roasts, as after a restart", () => {
    const roasts = [
      roast(1, '2026-11-08T09:00:00.000Z', '2026-11-08T09:16:00.000Z', 600),
      roast(1, '2026-11-08T09:30:00.000Z', '2026-11-08T09:45:00.000Z', 620),
      roast(2, '2026-11-08T09:50:00.000Z', '2026-11-08T09:59:00.000Z', 500),
    ];
    expect(lastRoastEndMs(roasts, 1)).toBe(Date.parse('2026-11-08T09:45:00.000Z'));
  });

  it('falls back on the drop of a roast that never finished cooling', () => {
    expect(lastRoastEndMs([roast(1, '2026-11-08T09:00:00.000Z', null, 600)], 1)).toBe(
      Date.parse('2026-11-08T09:10:00.000Z'),
    );
  });

  it('is null with no roast on this roaster, or none that ended', () => {
    expect(lastRoastEndMs([], 1)).toBeNull();
    expect(lastRoastEndMs([roast(1, '2026-11-08T09:00:00.000Z', null, null)], 1)).toBeNull();
    expect(
      lastRoastEndMs([roast(2, '2026-11-08T09:00:00.000Z', '2026-11-08T09:10:00.000Z', 1)], 1),
    ).toBeNull();
  });
});
