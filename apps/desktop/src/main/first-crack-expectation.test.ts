import { silentLogger } from '@roastpilot/core';
import type { RoastSummary } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { FirstCrackExpectation } from './first-crack-expectation';

const roast = (fcTemp: number | null, roasterId = 1) =>
  ({ fcTemp, roasterId, startedAt: '2026-11-01T09:00:00.000Z' }) as RoastSummary;

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('FirstCrackExpectation', () => {
  it('is unknown until History has answered, then the median of the recent first cracks', async () => {
    const expectation = new FirstCrackExpectation({
      list: () => Promise.resolve([roast(194), roast(198), roast(null)]),
      roasterId: () => 1,
      logger: silentLogger,
    });
    expect(expectation.expectedC).toBeUndefined();
    expectation.refresh();
    await settle();
    expect(expectation.expectedC).toBe(196);
  });

  it('keeps the last value, and logs, when History fails', async () => {
    const logger = { ...silentLogger, error: vi.fn() };
    let fail = false;
    const expectation = new FirstCrackExpectation({
      list: () => (fail ? Promise.reject(new Error('locked')) : Promise.resolve([roast(200)])),
      roasterId: () => 1,
      logger,
    });
    expectation.refresh();
    await settle();
    fail = true;
    expectation.refresh();
    await settle();
    expect(expectation.expectedC).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      'coach.expected-first-crack-failed',
      expect.anything(),
    );
  });
});
