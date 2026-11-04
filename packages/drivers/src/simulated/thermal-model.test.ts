import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THERMAL_CONSTANTS,
  stepRoaster,
  stepTemperature,
  type RoasterTemps,
  type ThermalInputs,
} from './thermal-model';

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

describe('stepRoaster', () => {
  const run = (temps: RoasterTemps, seconds: number, heater = 70) => {
    let t = temps;
    const probe: number[] = [];
    for (let i = 0; i < seconds * 10; i++) {
      t = stepRoaster(t, { heater, fan: 30, cooling: 0 }, DEFAULT_THERMAL_CONSTANTS, 0.1);
      if (i % 10 === 9) probe.push(t.probeC);
    }
    return { temps: t, probe };
  };

  it('without beans, the probe reads the drum', () => {
    const { temps } = run({ drumC: 180, beansC: undefined, probeC: 180 }, 10);
    expect(temps.probeC).toBe(temps.drumC);
  });

  it('with beans, BT dips after charge and turns around 85–95 °C after about a minute', () => {
    const { probe } = run({ drumC: 181, beansC: 22, probeC: 181 }, 180);
    const low = Math.min(...probe);
    const at = probe.indexOf(low) + 1;
    expect(low).toBeGreaterThan(80);
    expect(low).toBeLessThan(100);
    expect(at).toBeGreaterThan(50);
    expect(at).toBeLessThan(100);
    expect(probe.at(-1)).toBeGreaterThan(low + 10);
  });
});
