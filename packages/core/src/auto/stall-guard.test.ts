import { describe, expect, it } from 'vitest';
import { STALL, StallGuard } from './stall-guard';

/** Feeds one RoR value every 30 s, like the tables in roast-control.md. */
function run(guard: StallGuard, rors: readonly number[], fan = 80, heaterMaxed = true) {
  return rors.map((ror, i) =>
    guard.update({
      elapsedS: 300 + i * 30,
      ror,
      plannedFanPct: fan,
      firstCracked: false,
      heaterMaxed,
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
      guard.update({
        elapsedS: 300,
        ror: 9,
        plannedFanPct: 80,
        firstCracked: false,
        heaterMaxed: true,
      }).tripped,
    ).toBe(false);
    expect(
      guard.update({
        elapsedS: 310,
        ror: 6,
        plannedFanPct: 80,
        firstCracked: false,
        heaterMaxed: true,
      }).tripped,
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

  it('does not trip on the planned fall at the start of Maillard', () => {
    // 6:30 to 9:00, roasts 15–17 of 2026-11-08: the heater steps down and RoR falls from about 12
    // at over 4 °C/min a minute, then levels out near 7 before first crack.
    const rors = [12.4, 11.1, 9.9, 8.6, 7.9, 7.5, 7.3, 7.2, 7.2, 7.1];
    const results = run(new StallGuard(), rors);
    expect(results.some((r) => r.tripped)).toBe(false);
  });

  it('still trips on a fall that starts above 8 once RoR is below it', () => {
    const results = run(new StallGuard(), [12, 10.5, 9, 7.5]);
    expect(results.slice(0, 3).some((r) => r.tripped)).toBe(false);
    expect(results.at(-1)?.tripped).toBe(true);
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
    const after = guard.update({
      elapsedS: 400,
      ror: 2,
      plannedFanPct: 80,
      firstCracked: true,
      heaterMaxed: true,
    });
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
      heaterMaxed: true,
    });
    expect(result.tripped).toBe(true);
  });

  describe('fan', () => {
    it('follows the plan, increases too, while the heater has more to give', () => {
      const guard = new StallGuard();
      const results = run(guard, [6, 4, 4, 4, 4], 65, false);
      expect(results.every((r) => r.tripped || r.fanPct === 65)).toBe(true);
      expect(results.map((r) => r.fanPct)).toEqual([65, 65, 65, 65, 65]);
      const result = guard.update({
        elapsedS: 425,
        ror: 4,
        plannedFanPct: 80,
        firstCracked: false,
        heaterMaxed: false,
      });
      expect(result).toEqual({ tripped: true, fanPct: 80 });
    });

    it('waits 30 s with the heater at its limit before it touches the fan', () => {
      const guard = new StallGuard();
      run(guard, [6, 4], 80);
      const update = (elapsedS: number) =>
        guard.update({
          elapsedS,
          ror: 4,
          plannedFanPct: 80,
          firstCracked: false,
          heaterMaxed: true,
        });
      expect(update(359).fanPct).toBe(80);
      expect(update(360).fanPct).toBe(75);
    });

    it('starts the wait over when the heater has more to give again', () => {
      const guard = new StallGuard();
      const update = (elapsedS: number, ror: number, heaterMaxed: boolean) =>
        guard.update({ elapsedS, ror, plannedFanPct: 80, firstCracked: false, heaterMaxed });
      update(300, 6, true);
      update(330, 4, true);
      update(350, 4, false);
      expect(update(360, 4, true).fanPct).toBe(80);
      expect(update(390, 4, true).fanPct).toBe(75);
    });

    it('holds a planned increase once the fan is held', () => {
      const guard = new StallGuard();
      run(guard, [6, 4, 4], 65);
      const result = guard.update({
        elapsedS: 365,
        ror: 4,
        plannedFanPct: 80,
        firstCracked: false,
        heaterMaxed: true,
      });
      expect(result.fanPct).toBe(60);
    });

    it('steps down 5% every 30 s, to at most 20% below the plan', () => {
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
        heaterMaxed: true,
      });
      expect(result.fanPct).toBe(50);
    });
  });
});
