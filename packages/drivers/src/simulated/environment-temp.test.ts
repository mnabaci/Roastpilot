import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENVIRONMENT_CONSTANTS,
  heaterLiftC,
  stepEnvironment,
  type EnvironmentTemps,
} from './environment-temp';

const constants = DEFAULT_ENVIRONMENT_CONSTANTS;
const inputs = (heater: number, fan: number) => ({ heater, fan, cooling: 0 });

/** Runs the air for `seconds` in 100 ms steps over a drum held at `drumC`. */
function run(
  start: EnvironmentTemps,
  drumC: number,
  heater: number,
  fan: number,
  seconds: number,
): EnvironmentTemps {
  let temps = start;
  for (let i = 0; i < seconds * 10; i++) {
    temps = stepEnvironment(temps, drumC, inputs(heater, fan), constants, 0.1);
  }
  return temps;
}

describe('environment temperature', () => {
  it("adds the heater's lift, less with more fan", () => {
    expect(heaterLiftC(inputs(0, 0), constants)).toBe(0);
    expect(heaterLiftC(inputs(100, 0), constants)).toBe(25);
    expect(heaterLiftC(inputs(100, 100), constants)).toBe(12.5);
  });

  it('follows a heater change within seconds, not minutes', () => {
    const steady = { baseC: 180, etC: 180 };
    expect(run(steady, 180, 100, 0, 10).etC).toBeGreaterThan(195);
    expect(run(steady, 180, 100, 0, 60).etC).toBeCloseTo(205, 1);
  });

  it('settles a few degrees above the drum in a steady preheat', () => {
    const { etC } = run({ baseC: 200, etC: 200 }, 200, 50, 30, 120);
    expect(etC - 200).toBeGreaterThan(5);
    expect(etC - 200).toBeLessThan(15);
  });

  it('follows the drum metal slowly, so a quick drop in the drum moves it much less', () => {
    const { etC } = run({ baseC: 200, etC: 200 }, 150, 0, 0, 30);
    expect(200 - etC).toBeLessThan(20);
  });
});
