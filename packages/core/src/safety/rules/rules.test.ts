import type { Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SAFETY_LIMITS as limits } from '../safety-limits';
import type { SafetyState } from '../safety-rule';
import { frozenReadingRule } from './frozen-reading';
import { lostConnectionRule } from './lost-connection';
import { maxRoastTimeRule } from './max-roast-time';
import { maxTemperatureRule } from './max-temperature';
import { slowRiseRule } from './slow-rise';

function state(overrides: Partial<SafetyState> = {}): SafetyState {
  return {
    nowMs: 0,
    armed: true,
    lastValidReadingMs: 0,
    history: [],
    roastStartedMs: undefined,
    turningPointMs: undefined,
    ...overrides,
  };
}

/** One reading per second from t = 0 with the given temperatures and heater. */
function readings(temps: number[], heater: number): Reading[] {
  return temps.map((bt, i) => ({ atMs: i * 1000, values: { bt, heater } }));
}

const at = (atMs: number, bt: number, heater = 0): Reading => ({ atMs, values: { bt, heater } });

describe('maxTemperatureRule', () => {
  it.each([
    [239.9, false],
    [240, true],
    [251, true],
  ])('at %d °C tripped is %s', (bt, tripped) => {
    expect(maxTemperatureRule.isTripped(state({ history: [at(0, bt)] }), limits)).toBe(tripped);
  });

  it('does not trip without readings', () => {
    expect(maxTemperatureRule.isTripped(state(), limits)).toBe(false);
  });
});

describe('lostConnectionRule', () => {
  it.each([
    [2999, false],
    [3000, true],
  ])('%d ms after the last valid reading tripped is %s', (nowMs, tripped) => {
    expect(lostConnectionRule.isTripped(state({ nowMs, lastValidReadingMs: 0 }), limits)).toBe(
      tripped,
    );
  });

  it('cannot trip before the roaster has connected', () => {
    expect(lostConnectionRule.isTripped(state({ nowMs: 60_000, armed: false }), limits)).toBe(
      false,
    );
  });
});

describe('maxRoastTimeRule', () => {
  it.each([
    [20 * 60_000 - 1, false],
    [20 * 60_000, true],
  ])('%d ms after charge tripped is %s', (nowMs, tripped) => {
    expect(maxRoastTimeRule.isTripped(state({ nowMs, roastStartedMs: 0 }), limits)).toBe(tripped);
  });

  it('does not trip outside a roast', () => {
    expect(maxRoastTimeRule.isTripped(state({ nowMs: 3_600_000 }), limits)).toBe(false);
  });
});

describe('slowRiseRule', () => {
  const temps = (rise: number) => Array.from({ length: 61 }, (_, i) => 150 + (rise * i) / 60);

  it('trips when 60 s at heater 50% rise less than 1 °C', () => {
    expect(slowRiseRule.isTripped(state({ history: readings(temps(0.9), 50) }), limits)).toBe(true);
  });

  it('does not trip at a 1 °C rise', () => {
    expect(slowRiseRule.isTripped(state({ history: readings(temps(1), 50) }), limits)).toBe(false);
  });

  it('does not trip below heater 50%', () => {
    expect(slowRiseRule.isTripped(state({ history: readings(temps(0), 45) }), limits)).toBe(false);
  });

  it('needs a full 60 s of history', () => {
    expect(
      slowRiseRule.isTripped(state({ history: readings(temps(0).slice(0, 60), 80) }), limits),
    ).toBe(false);
  });

  describe('the charge dip', () => {
    // BT falling for a minute after charge at 70 % heater, as when the beans go in.
    const dip = readings(
      Array.from({ length: 61 }, (_, i) => 180 - i),
      70,
    );
    const flat = readings(temps(0), 70);

    it('does not trip while BT falls after charge', () => {
      const s = state({ nowMs: 60_000, history: dip, roastStartedMs: 0 });
      expect(slowRiseRule.isTripped(s, limits)).toBe(false);
    });

    it('counts a full window from the turning point', () => {
      const from = (turningPointMs: number) =>
        slowRiseRule.isTripped(
          state({ nowMs: 60_000, history: flat, roastStartedMs: -60_000, turningPointMs }),
          limits,
        );
      expect(from(1000)).toBe(false);
      expect(from(0)).toBe(true);
    });

    it('with no turning point, counts from 3 min after charge', () => {
      const charged = (roastStartedMs: number) =>
        slowRiseRule.isTripped(state({ nowMs: 60_000, history: flat, roastStartedMs }), limits);
      expect(charged(-179_000)).toBe(false);
      expect(charged(-180_000)).toBe(true);
    });

    it('outside a roast, a fall at heater 70 % still trips', () => {
      expect(slowRiseRule.isTripped(state({ nowMs: 60_000, history: dip }), limits)).toBe(true);
    });
  });

  it('needs the heater at 50% for the whole window', () => {
    const history = readings(temps(0), 80);
    history[0] = at(0, 150, 0);
    expect(slowRiseRule.isTripped(state({ history }), limits)).toBe(false);
  });
});

describe('frozenReadingRule', () => {
  const same = (count: number, heater: number) =>
    readings(Array<number>(count).fill(120.5), heater);

  it('trips when the same reading repeats for 10 s while heating', () => {
    expect(frozenReadingRule.isTripped(state({ history: same(11, 30) }), limits)).toBe(true);
  });

  it('does not trip before 10 s', () => {
    expect(frozenReadingRule.isTripped(state({ history: same(10, 30) }), limits)).toBe(false);
  });

  it('never trips at idle: the real roaster sat at 29.98 °C for minutes', () => {
    const idle = readings(Array<number>(300).fill(29.98), 0);
    expect(frozenReadingRule.isTripped(state({ history: idle }), limits)).toBe(false);
  });

  it('starts counting when the heater turns on', () => {
    const history = [
      ...readings(Array<number>(30).fill(29.98), 0),
      at(30_000, 29.98, 40),
      at(35_000, 29.98, 40),
    ];
    expect(frozenReadingRule.isTripped(state({ history }), limits)).toBe(false);
  });

  it('does not trip when the temperature moves', () => {
    const history = same(11, 30);
    history[5] = at(5000, 120.6, 30);
    expect(frozenReadingRule.isTripped(state({ history }), limits)).toBe(false);
  });
});
