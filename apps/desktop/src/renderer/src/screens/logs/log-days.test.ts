import { describe, expect, it } from 'vitest';
import { dayLabel, localDay, viewerDays } from './log-days';

describe('log days', () => {
  it('names a local calendar day like the log files', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('puts today first even without a file yet', () => {
    expect(viewerDays(['2026-11-02', '2026-11-01'], '2026-11-03')).toEqual([
      '2026-11-03',
      '2026-11-02',
      '2026-11-01',
    ]);
    expect(viewerDays(['2026-11-03', '2026-11-02'], '2026-11-03')).toEqual([
      '2026-11-03',
      '2026-11-02',
    ]);
  });

  it('labels Today, Yesterday, then a short date, across a month end', () => {
    expect(dayLabel('2026-11-01', '2026-11-01')).toBe('Today');
    expect(dayLabel('2026-10-31', '2026-11-01')).toBe('Yesterday');
    expect(dayLabel('2026-10-30', '2026-11-01')).toBe('Fri 30 Oct');
  });
});
