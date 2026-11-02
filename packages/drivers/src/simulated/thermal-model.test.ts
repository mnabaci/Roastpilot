import { describe, expect, it } from 'vitest';
import { DEFAULT_THERMAL_CONSTANTS, stepTemperature, type ThermalInputs } from './thermal-model';

const off: ThermalInputs = { heater: 0, fan: 0, cooling: 0 };

function run(start: number, inputs: ThermalInputs, seconds: number): number {
  let temp = start;
  for (let i = 0; i < seconds * 10; i++)
    temp = stepTemperature(temp, inputs, DEFAULT_THERMAL_CONSTANTS, 0.1);
  return temp;
}

describe('stepTemperature', () => {
  it('stays at ambient with everything off', () => {
    expect(stepTemperature(22, off, DEFAULT_THERMAL_CONSTANTS, 1)).toBe(22);
  });

  it('heats at the heat gain from ambient', () => {
    expect(stepTemperature(22, { ...off, heater: 100 }, DEFAULT_THERMAL_CONSTANTS, 1)).toBeCloseTo(
      23.5,
    );
  });

  it('levels off near 300 °C at full heat with the fan off', () => {
    expect(run(22, { ...off, heater: 100 }, 3600)).toBeCloseTo(300, 0);
  });

  it('cools faster with the fan on, and faster still with cooling on', () => {
    const still = run(200, off, 60);
    const fan = run(200, { ...off, fan: 100 }, 60);
    const cooling = run(200, { ...off, fan: 100, cooling: 100 }, 60);
    expect(fan).toBeLessThan(still);
    expect(cooling).toBeLessThan(fan);
  });
});
