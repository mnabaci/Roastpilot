import { describe, expect, it } from 'vitest';
import { STALL, StallGuard } from './stall-guard';

/** Feeds one RoR value every 30 s, like the tables in roast-control.md. */
function run(guard: StallGuard, rors: readonly number[], fan = 80, startS = 300) {
  return rors.map((ror, i) =>
    guard.update({
      elapsedS: startS + i * 30,
      ror,
      plannedFanPct: fan,
      firstCracked: false,
    }),
  );
}

describe('StallGuard', () => {
  it('leaves the roast alone while RoR is healthy', () => {
    const results = run(new StallGuard(), [12, 12, 11, 11, 10]);
    expect(results.every((r) => !r.tripped && r.fanPct === 80)).toBe(true);
  });

  it('is not armed by the climb out of the turning point', () => {
    const results = run(new StallGuard(), [-3, 0, 2, 4]);
    expect(results.some((r) => r.tripped)).toBe(false);
  });

  it('trips below 5 °C/min once armed', () => {
    const results = run(new StallGuard(), [6, 6, 4.5]);
    expect(results.at(-1)?.tripped).toBe(true);
  });

  it('trips early when RoR will reach 5 within 60 s', () => {
    const results = run(new StallGuard(), [9, 8, 7, 6]);
    expect(results.at(-1)?.tripped).toBe(true);
  });

  it('needs enough history before it trusts a rate of fall', () => {
    const guard = new StallGuard();
    expect(
      guard.update({ elapsedS: 300, ror: 9, plannedFanPct: 80, firstCracked: false }).tripped,
    ).toBe(false);
    expect(
      guard.update({ elapsedS: 310, ror: 6, plannedFanPct: 80, firstCracked: false }).tripped,
    ).toBe(false);
  });

  it('does not trip on the RoR of roast 7 before its first crack', () => {
    // 7:00 to 9:30, roast 7 of 2026-11-04.
    const results = run(new StallGuard(), [10.4, 8.9, 7.8, 7.5, 7.5, 6.3]);
    expect(results.some((r) => r.tripped)).toBe(false);
  });

  it('trips on the RoR of roast 6 well before it stalled', () => {
    // 7:00 to 11:30, roast 6 of 2026-11-04: RoR fell to 2.6 by 11:30.
    const rors = [10.6, 9.6, 8.5, 7.3, 6.1, 6.1, 6.1, 5.4, 4.1, 2.6];
    const results = run(new StallGuard(), rors);
    const firstTrip = results.findIndex((r) => r.tripped);
    expect(firstTrip).toBeGreaterThanOrEqual(0);
    expect(firstTrip).toBeLessThanOrEqual(4);
  });

  it('clears only at 6 °C/min or more', () => {
    const results = run(new StallGuard(), [6, 4, 5.5, 6, 6, 6, 6]);
    expect(results[1]?.tripped).toBe(true);
    expect(results[2]?.tripped).toBe(true);
    expect(results.at(-1)?.tripped).toBe(false);
  });

  it('stands down at first crack', () => {
    const guard = new StallGuard();
    run(guard, [6, 4]);
    const after = guard.update({ elapsedS: 400, ror: 2, plannedFanPct: 80, firstCracked: true });
    expect(after.tripped).toBe(false);
  });

  it('keeps its state when a reading has no RoR', () => {
    const guard = new StallGuard();
    run(guard, [6, 4]);
    const result = guard.update({
      elapsedS: 400,
      ror: undefined,
      plannedFanPct: 80,
      firstCracked: false,
    });
    expect(result.tripped).toBe(true);
  });

  describe('fan', () => {
    it('holds a planned increase while tripped', () => {
      const guard = new StallGuard();
      run(guard, [6, 4], 65);
      const result = guard.update({
        elapsedS: 335,
        ror: 4,
        plannedFanPct: 80,
        firstCracked: false,
      });
      expect(result.fanPct).toBe(65);
    });

    it('steps down 5% every 30 s, to at most 20% below where it tripped', () => {
      const results = run(new StallGuard(), [6, 4, 4, 4, 4, 4, 4, 4, 4]);
      expect(results.map((r) => r.fanPct)).toEqual([80, 80, 75, 70, 65, 60, 60, 60, 60]);
      expect(80 - STALL.maxFanBelowPct).toBe(60);
    });

    it('never goes below 0', () => {
      const results = run(new StallGuard(), [6, 4, 4, 4, 4, 4, 4], 10);
      expect(results.every((r) => r.fanPct >= 0)).toBe(true);
      expect(results.at(-1)?.fanPct).toBe(0);
    });

    it('steps back up 5% every 30 s after it clears, then follows the plan', () => {
      const results = run(new StallGuard(), [6, 4, 4, 7, 7, 7, 7, 7, 7]);
      expect(results.map((r) => r.fanPct)).toEqual([80, 80, 75, 80, 80, 80, 80, 80, 80]);
    });

    it('never runs above the plan', () => {
      const guard = new StallGuard();
      run(guard, [6, 4], 80);
      const result = guard.update({
        elapsedS: 340,
        ror: 4,
        plannedFanPct: 50,
        firstCracked: false,
      });
      expect(result.fanPct).toBe(50);
    });
  });
});
