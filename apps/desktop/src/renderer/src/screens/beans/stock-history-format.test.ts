import { describe, expect, it } from 'vitest';
import { stockKind } from './stock-history-format';

describe('stockKind', () => {
  it('names a roast, and one whose roast is deleted', () => {
    expect(stockKind({ kind: 'roasted', note: null, roastId: 3 })).toBe('Roasted');
    expect(stockKind({ kind: 'roasted', note: null, roastId: null })).toBe(
      'Roasted · roast deleted',
    );
  });

  it('adds your note, and nothing else to a row without a roast', () => {
    expect(stockKind({ kind: 'taken', note: 'Gave 200 g to Sam', roastId: null })).toBe(
      'Taken out · Gave 200 g to Sam',
    );
    expect(stockKind({ kind: 'bought', note: null, roastId: null })).toBe('Bought');
    expect(stockKind({ kind: 'returned', note: null, roastId: null })).toBe('Returned at Clear');
  });
});
