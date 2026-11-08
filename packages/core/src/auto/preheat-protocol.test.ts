import {
  CURVE_FOLLOW_DEFAULTS,
  PROFILE_SCHEMA_VERSION,
  type AutoProfile,
  type AutoTuning,
} from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import type { PreheatHold } from './preheat-hold';
import { PREHEAT, PreheatProtocol } from './preheat-protocol';

const PROFILE = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'light-steps',
  name: 'Light · Steps',
  needsCalibration: true,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 90,
  capC: 200,
  curve: [
    { tS: 0, c: 180 },
    { tS: 60, c: 92 },
  ],
  phases: [{ name: 'Only', heat: { mode: 'fixed', pct: 0 }, fanPct: 30, next: { on: 'end' } }],
} satisfies AutoProfile;

const TUNING: AutoTuning = {
  target: { kp: 1, ki: 0, kd: 0 },
  targetLimitPct: 20,
  curveFollow: CURVE_FOLLOW_DEFAULTS,
  preheat: { kp: 2, ki: 0, kd: 0 },
  preheatFanPct: 30,
  holdS: 150,
  nextHoldS: 120,
  chargeCutS: 5,
};

const FIRST = { s: 150, batch: 'first' } as const;
const newProtocol = (
  hold: { s: number; batch: 'first' | 'next' } = FIRST,
  chosenS: number | null = null,
) => new PreheatProtocol(PROFILE, TUNING, hold, chosenS);

/** A protocol holding since 1 s in. */
function holding(hold: PreheatHold = FIRST, chosenS: number | null = null): PreheatProtocol {
  const protocol = newProtocol(hold, chosenS);
  protocol.next(0, 150);
  protocol.next(1_000, 179);
  return protocol;
}

/** A protocol already at "Add beans", and the time it got there. */
function atAddBeans(): { protocol: PreheatProtocol; nowMs: number } {
  const protocol = newProtocol();
  protocol.next(0, 150);
  protocol.next(1_000, 179);
  const nowMs = 1_000 + 150_000;
  protocol.next(nowMs, 180);
  return { protocol, nowMs };
}

describe('PreheatProtocol', () => {
  it('climbs from a cold roaster with the PID and the preheat fan', () => {
    const protocol = newProtocol();
    const outputs = protocol.next(0, 150);
    expect(protocol.step).toBe('climb');
    expect(outputs).toMatchObject({ fanPct: 30, gaveUp: false });
  });

  it('heats at most 100% and at least 0%', () => {
    const protocol = newProtocol();
    protocol.next(0, 20);
    expect(protocol.next(1_000, 20).heaterPct).toBe(100);
    expect(protocol.next(2_000, 179.5).heaterPct).toBe(1);
    expect(protocol.next(3_000, 190).heaterPct).toBe(0);
  });

  it('cools a hot roaster first: heat 0, fan 100, down to 20 °C below charge', () => {
    const protocol = newProtocol();
    expect(protocol.next(0, 171)).toEqual({ heaterPct: 0, fanPct: 100, gaveUp: false });
    expect(protocol.step).toBe('cool');
    expect(protocol.next(1_000, 161).heaterPct).toBe(0);
    expect(protocol.step).toBe('cool');
    protocol.next(2_000, 160);
    expect(protocol.step).toBe('climb');
  });

  it('does not cool at exactly 10 °C below charge', () => {
    const protocol = newProtocol();
    protocol.next(0, 170);
    expect(protocol.step).toBe('climb');
  });

  it('holds once within 1 °C of charge, counting down', () => {
    const protocol = newProtocol();
    protocol.next(0, 170);
    protocol.next(1_000, 179);
    expect(protocol.step).toBe('hold');
    expect(protocol.leftS).toBe(150);
    protocol.next(61_000, 180);
    expect(protocol.leftS).toBe(90);
  });

  it('shows "Add beans" after the hold and keeps heating', () => {
    const { protocol, nowMs } = atAddBeans();
    expect(protocol.step).toBe('add-beans');
    expect(protocol.next(nowMs + 1_000, 175).heaterPct).toBe(10);
  });

  it('refuses Charge soon before "Add beans"', () => {
    const protocol = newProtocol();
    protocol.next(0, 150);
    expect(protocol.chargeSoon(1_000)).toBe(false);
    expect(protocol.step).toBe('climb');
  });

  it('Charge soon: heater 0, countdown, then "Beans in"', () => {
    const { protocol, nowMs } = atAddBeans();
    expect(protocol.chargeSoon(nowMs)).toBe(true);
    expect(protocol.next(nowMs + 1_000, 170)).toEqual({ heaterPct: 0, fanPct: 30, gaveUp: false });
    expect(protocol.step).toBe('charge-cut');
    expect(protocol.leftS).toBe(4);
    expect(protocol.next(nowMs + 5_000, 170).heaterPct).toBe(0);
    expect(protocol.step).toBe('beans-in');
    expect(protocol.leftS).toBeNull();
  });

  it('goes back to holding with no Start within 30 s of the countdown', () => {
    const { protocol, nowMs } = atAddBeans();
    protocol.chargeSoon(nowMs);
    protocol.next(nowMs + 5_000, 170);
    expect(protocol.next(nowMs + 34_000, 170).heaterPct).toBe(0);
    expect(protocol.step).toBe('beans-in');
    expect(protocol.next(nowMs + 35_000, 170).heaterPct).toBe(20);
    expect(protocol.step).toBe('add-beans');
    expect(protocol.chargeSoon(nowMs + 36_000)).toBe(true);
  });

  it('turns the heater off with no reading', () => {
    const protocol = newProtocol();
    protocol.next(0, 150);
    expect(protocol.next(1_000, undefined).heaterPct).toBe(0);
  });

  it.each([
    ['cool', 175],
    ['climb', 100],
  ])('gives up after 15 min stuck in %s', (step, btC) => {
    const protocol = newProtocol();
    protocol.next(0, btC);
    expect(protocol.step).toBe(step);
    expect(protocol.next(PREHEAT.stepLimitMs - 1, btC).gaveUp).toBe(false);
    expect(protocol.next(PREHEAT.stepLimitMs, btC)).toMatchObject({ heaterPct: 0, gaveUp: true });
  });

  it('gives up 10 min after "Add beans", also if Charge soon was pressed on the way', () => {
    const { protocol, nowMs } = atAddBeans();
    expect(protocol.next(nowMs + PREHEAT.waitingLimitMs - 1, 180).gaveUp).toBe(false);
    protocol.chargeSoon(nowMs + PREHEAT.waitingLimitMs - 1);
    expect(protocol.next(nowMs + PREHEAT.waitingLimitMs, 180)).toMatchObject({
      heaterPct: 0,
      gaveUp: true,
    });
  });

  describe('the hold', () => {
    it("runs the length picked for the batch: the next batch's shorter one", () => {
      const protocol = holding({ s: 120, batch: 'next' } as const);
      expect(protocol.hold).toEqual({ s: 120, batch: 'next', chosen: false });
      protocol.next(1_000 + 119_000, 180);
      expect(protocol.step).toBe('hold');
      protocol.next(1_000 + 120_000, 180);
      expect(protocol.step).toBe('add-beans');
    });

    it('runs your choice for this roast instead, and says it is yours', () => {
      const protocol = holding(FIRST, 180);
      expect(protocol.hold).toEqual({ s: 180, batch: 'first', chosen: true });
      protocol.next(1_000 + 150_000, 180);
      expect(protocol.step).toBe('hold');
      expect(protocol.leftS).toBe(30);
    });

    it('a choice mid-hold applies to what is left', () => {
      const protocol = holding();
      protocol.next(61_000, 180);
      protocol.choose(165);
      expect(protocol.leftS).toBe(105);
      protocol.choose(null);
      expect(protocol.leftS).toBe(90);
    });

    it('a choice shorter than what it has held already ends the hold now, never before it began', () => {
      const protocol = holding();
      protocol.next(121_000, 180);
      protocol.choose(90);
      expect(protocol.leftS).toBe(0);
      protocol.next(122_000, 180);
      expect(protocol.step).toBe('add-beans');
    });
  });
});
