import { PROFILE_SCHEMA_VERSION, type AutoProfile, type AutoTuning } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
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
  follow: { kp: 1, ki: 0, kd: 0 },
  preheat: { kp: 2, ki: 0, kd: 0 },
  preheatFanPct: 30,
  holdS: 150,
  chargeCutS: 5,
};

/** A protocol already at "Add beans", and the time it got there. */
function atAddBeans(): { protocol: PreheatProtocol; nowMs: number } {
  const protocol = new PreheatProtocol(PROFILE, TUNING);
  protocol.next(0, 150);
  protocol.next(1_000, 179);
  const nowMs = 1_000 + 150_000;
  protocol.next(nowMs, 180);
  return { protocol, nowMs };
}

describe('PreheatProtocol', () => {
  it('climbs from a cold roaster with the PID and the preheat fan', () => {
    const protocol = new PreheatProtocol(PROFILE, TUNING);
    const outputs = protocol.next(0, 150);
    expect(protocol.step).toBe('climb');
    expect(outputs).toMatchObject({ fanPct: 30, gaveUp: false });
  });

  it('heats at most 100% and at least 0%', () => {
    const protocol = new PreheatProtocol(PROFILE, TUNING);
    protocol.next(0, 20);
    expect(protocol.next(1_000, 20).heaterPct).toBe(100);
    expect(protocol.next(2_000, 179.5).heaterPct).toBe(1);
    expect(protocol.next(3_000, 190).heaterPct).toBe(0);
  });

  it('cools a hot roaster first: heat 0, fan 100, down to 20 °C below charge', () => {
    const protocol = new PreheatProtocol(PROFILE, TUNING);
    expect(protocol.next(0, 171)).toEqual({ heaterPct: 0, fanPct: 100, gaveUp: false });
    expect(protocol.step).toBe('cool');
    expect(protocol.next(1_000, 161).heaterPct).toBe(0);
    expect(protocol.step).toBe('cool');
    protocol.next(2_000, 160);
    expect(protocol.step).toBe('climb');
  });

  it('does not cool at exactly 10 °C below charge', () => {
    const protocol = new PreheatProtocol(PROFILE, TUNING);
    protocol.next(0, 170);
    expect(protocol.step).toBe('climb');
  });

  it('holds once within 1 °C of charge, counting down', () => {
    const protocol = new PreheatProtocol(PROFILE, TUNING);
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
    const protocol = new PreheatProtocol(PROFILE, TUNING);
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
    const protocol = new PreheatProtocol(PROFILE, TUNING);
    protocol.next(0, 150);
    expect(protocol.next(1_000, undefined).heaterPct).toBe(0);
  });

  it.each([
    ['cool', 175],
    ['climb', 100],
  ])('gives up after 15 min stuck in %s', (step, btC) => {
    const protocol = new PreheatProtocol(PROFILE, TUNING);
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
});
