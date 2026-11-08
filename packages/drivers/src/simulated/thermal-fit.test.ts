import { describe, expect, it } from 'vitest';
import {
  BEANS_IN_ONLY,
  EVERY_READING,
  fitError,
  fitThermalConstants,
  replayRoast,
  type FitSample,
} from './thermal-fit';
import {
  DEFAULT_THERMAL_CONSTANTS,
  removeBeans,
  stepRoaster,
  type ThermalConstants,
} from './thermal-model';

/** A roast made by the model itself: preheat, charge at 0, turn the heat down, drop at 500 s. */
function syntheticRoast(constants: ThermalConstants): FitSample[] {
  const samples: FitSample[] = [];
  let temps = { drumC: 30, beansC: undefined as number | undefined, probeC: 30 };
  for (let tS = -300; tS <= 700; tS++) {
    const beans = tS >= 0 && tS < 500;
    const inputs = {
      heater: tS < 0 ? 100 : tS < 500 ? 70 : 0,
      fan: tS < 300 ? 30 : 80,
      cooling: tS >= 500 ? 100 : 0,
    };
    samples.push({ tS, bt: temps.probeC, beans, ...inputs });
    if (beans && temps.beansC === undefined) temps = { ...temps, beansC: constants.ambientC };
    if (!beans && temps.beansC !== undefined) temps = removeBeans(temps);
    for (let s = 0; s < 2; s++) temps = stepRoaster(temps, inputs, constants, 0.5);
  }
  return samples;
}

describe('replayRoast', () => {
  it('reproduces readings the model made', () => {
    const roast = syntheticRoast(DEFAULT_THERMAL_CONSTANTS);
    expect(fitError([roast], DEFAULT_THERMAL_CONSTANTS)).toBeLessThan(0.5);
  });

  it('starts at the first reading and returns one value per reading', () => {
    const roast = syntheticRoast(DEFAULT_THERMAL_CONSTANTS);
    const probe = replayRoast(roast, DEFAULT_THERMAL_CONSTANTS);
    expect(probe).toHaveLength(roast.length);
    expect(probe[0]).toBe(roast[0]?.bt);
  });

  it('returns nothing for no readings, and fitError is 0', () => {
    expect(replayRoast([], DEFAULT_THERMAL_CONSTANTS)).toEqual([]);
    expect(fitError([[]], DEFAULT_THERMAL_CONSTANTS)).toBe(0);
  });
});

describe('fitError', () => {
  // Off from the model by 10 °C in preheat and 2 °C with beans in. The first reading, where the
  // replay starts, stays.
  const made = syntheticRoast(DEFAULT_THERMAL_CONSTANTS);
  const probe = replayRoast(made, DEFAULT_THERMAL_CONSTANTS);
  const roast = made.map((sample, i) => ({
    ...sample,
    bt: (probe[i] ?? 0) + (i === 0 ? 0 : sample.tS < 0 ? 10 : sample.beans ? 2 : 0),
  }));
  const preheat = roast.filter((s) => s.tS < 0).length - 1;
  const beansIn = roast.filter((s) => s.beans).length;

  it('counts readings with beans in 20 times', () => {
    const expected = Math.sqrt((preheat * 100 + 20 * beansIn * 4) / (roast.length + 19 * beansIn));
    expect(fitError([roast], DEFAULT_THERMAL_CONSTANTS)).toBeCloseTo(expected, 1);
  });

  it('counts every reading the same, or only charge to drop, when asked', () => {
    const every = Math.sqrt((preheat * 100 + beansIn * 4) / roast.length);
    expect(fitError([roast], DEFAULT_THERMAL_CONSTANTS, EVERY_READING)).toBeCloseTo(every, 1);
    expect(fitError([roast], DEFAULT_THERMAL_CONSTANTS, BEANS_IN_ONLY)).toBeCloseTo(2, 1);
  });
});

describe('fitThermalConstants', () => {
  it('recovers the constants a roast was made with, from other starting values', () => {
    const truth = DEFAULT_THERMAL_CONSTANTS;
    const start: ThermalConstants = {
      ...truth,
      heatGainCPerS: 1.5,
      roomLossPerS: 0.0054,
      fanLossFactor: 1,
      coolingLossFactor: 3,
      probeLagS: 20,
    };
    const fit = fitThermalConstants([syntheticRoast(truth)], start);
    expect(fit.errorBefore).toBeGreaterThan(10);
    expect(fit.errorAfter).toBeLessThan(1);
    expect(fit.constants.heatGainCPerS).toBeCloseTo(truth.heatGainCPerS, 1);
    expect(fit.constants.probeLagS).toBeGreaterThan(35);
    expect(fit.constants.ambientC).toBe(truth.ambientC);
  });
});
