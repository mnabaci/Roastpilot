import { describe, expect, it } from 'vitest';
import { isPurchaseDate, today } from './purchase-date';

describe('purchase date', () => {
  it('starts on the local day', () => {
    expect(today(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('takes a real day typed as year-month-day', () => {
    expect(isPurchaseDate('2026-11-07')).toBe(true);
    expect(isPurchaseDate(' 2024-02-29 ')).toBe(true);
  });

  it('refuses anything else', () => {
    for (const text of ['', 'yesterday', '07/11/2026', '2026-13-01', '2025-02-29', '2026-1-5']) {
      expect(isPurchaseDate(text)).toBe(false);
    }
  });
});
