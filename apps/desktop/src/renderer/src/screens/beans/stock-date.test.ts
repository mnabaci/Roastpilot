import { describe, expect, it } from 'vitest';
import { isStockDate, today } from './stock-date';

const NOW = new Date(2026, 10, 11, 9, 0);

describe('stock date', () => {
  it('starts on the local day', () => {
    expect(today(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('takes a real day typed as year-month-day, up to today', () => {
    expect(isStockDate('2026-11-07', NOW)).toBe(true);
    expect(isStockDate(' 2024-02-29 ', NOW)).toBe(true);
    expect(isStockDate('2026-11-11', NOW)).toBe(true);
  });

  it('refuses a day after today', () => {
    expect(isStockDate('2026-11-12', NOW)).toBe(false);
  });

  it('refuses anything else', () => {
    for (const text of ['', 'yesterday', '07/11/2026', '2026-13-01', '2025-02-29', '2026-1-5']) {
      expect(isStockDate(text, NOW)).toBe(false);
    }
  });
});
