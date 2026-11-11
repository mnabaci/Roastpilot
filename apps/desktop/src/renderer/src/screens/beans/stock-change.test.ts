import { describe, expect, it } from 'vitest';
import { adjustedOn, recountChange } from './stock-change';
import { today } from './stock-date';

describe('stock change', () => {
  it('says what a count changes', () => {
    expect(recountChange(1580, 1664)).toBe('84 g less than the app had');
    expect(recountChange(1700, 1664)).toBe('36 g more than the app had');
    expect(recountChange(1664, 1664)).toBe('Same as the app has');
  });

  it('saves a picked day, and leaves today out so the change keeps its time', () => {
    expect(adjustedOn(' 2026-11-07 ')).toBe('2026-11-07');
    expect(adjustedOn(today())).toBeUndefined();
  });
});
