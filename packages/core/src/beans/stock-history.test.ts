import type { StockMovement } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { stockSummary, stockTimeline } from './stock-history';

const bought = (at: string, greenG: number): StockMovement => ({
  at,
  kind: 'bought',
  greenG,
  roastedG: 0,
  roastId: null,
  note: null,
});
const roasted = (at: string, batchG: number, roastId = 1): StockMovement => ({
  at,
  kind: 'roasted',
  greenG: -batchG,
  roastedG: batchG * 0.85,
  roastId,
  note: null,
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe('stockTimeline', () => {
  it('works the stock after each movement back from today', () => {
    const steps = stockTimeline(
      [
        bought('2026-10-01', 2000),
        roasted('2026-10-02T10:00:00Z', 400),
        roasted('2026-10-09T10:00:00Z', 400),
      ],
      1200,
    );
    expect(steps.map((s) => s.greenAfterG)).toEqual([2000, 1600, 1200]);
  });

  it('stays right now when older records are missing, and never below 0', () => {
    // 500 g were in the bag before any record: the first step shows them.
    const steps = stockTimeline([roasted('2026-10-02T10:00:00Z', 400)], 100);
    expect(steps.map((s) => s.greenAfterG)).toEqual([100]);
    const short = stockTimeline([bought('2026-10-01', 1000)], 0);
    expect(short.map((s) => s.greenAfterG)).toEqual([0]);
  });

  it('is empty with no movements', () => {
    expect(stockTimeline([], 500)).toEqual([]);
  });
});

describe('stockSummary', () => {
  const now = Date.parse('2026-11-01T00:00:00Z');

  it('adds up purchases and roasts, with the pace and how long the stock lasts', () => {
    const summary = stockSummary(
      [
        bought('2026-09-01', 2000),
        roasted(new Date(now - 28 * DAY_MS).toISOString(), 400),
        bought('2026-10-10', 1000),
        roasted(new Date(now - 7 * DAY_MS).toISOString(), 400),
      ],
      1000,
      now,
    );
    expect(summary).toEqual({
      timesBought: 2,
      boughtG: 3000,
      roasts: 2,
      usedG: 800,
      weeklyUseG: 200,
      weeksLeft: 5,
      lastBoughtAt: '2026-10-10',
    });
  });

  it('has no pace before two weeks of roasting', () => {
    const summary = stockSummary(
      [roasted(new Date(now - 3 * DAY_MS).toISOString(), 400)],
      600,
      now,
    );
    expect(summary).toMatchObject({ roasts: 1, weeklyUseG: null, weeksLeft: null });
  });

  it('is all zeros with no history', () => {
    expect(stockSummary([], 0, now)).toEqual({
      timesBought: 0,
      boughtG: 0,
      roasts: 0,
      usedG: 0,
      weeklyUseG: null,
      weeksLeft: null,
      lastBoughtAt: null,
    });
  });
});
