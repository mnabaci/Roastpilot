import { AutoProfileSchema, AutoTuningSchema } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { simulateAutoRoast } from './auto-simulation.harness';
import { SKYWALKER_PROFILES, SKYWALKER_TUNING } from './skywalker-profiles';

/**
 * Auto roast 16 of 2026-11-08 (356 g), the simulator's yardstick (docs/spec/hardware.md,
 * Simulator): Light · Steps as it was before the retune of roasts 15–17, with `ki` 0.02.
 */
const steps = SKYWALKER_PROFILES['light-steps'];
const ROAST_16_PROFILE = AutoProfileSchema.parse({
  ...steps,
  phases: steps.phases.map((phase, i) => {
    const heatPct = [0, 85, 65, 50, 40][i];
    if (phase.heat.mode !== 'target' || heatPct === undefined) return phase;
    return {
      ...phase,
      heat: { ...phase.heat, pct: heatPct, ...(i === 1 ? { durationS: 245 } : {}) },
    };
  }),
});
const ROAST_16_TUNING = AutoTuningSchema.parse({
  ...SKYWALKER_TUNING,
  target: { ...SKYWALKER_TUNING.target, ki: 0.02 },
});

/** Roast 16's BT every 30 s from 1:00 to 11:00. */
const ROAST_16_BT = [
  90.3, 89.0, 94.0, 101.2, 109.9, 118.3, 126.5, 135.6, 144.8, 153.4, 160.4, 166.3, 170.9, 175.1,
  179.2, 183.3, 186.9, 190.7, 193.6, 195.6, 197.4,
];

describe('the simulator against real Auto roast 16', () => {
  it('stays within 3 °C of its BT every 30 s from 1:00 to 11:00', async () => {
    const { rows } = await simulateAutoRoast({
      profile: ROAST_16_PROFILE,
      tuning: ROAST_16_TUNING,
      firstCrackAtC: 190.5,
    });
    ROAST_16_BT.forEach((bt, i) => {
      const tS = 60 + 30 * i;
      const row = rows.find((r) => r.tS >= tS);
      expect(Math.abs((row?.bt ?? 0) - bt), `at ${tS} s`).toBeLessThan(3);
    });
  });

  it('reaches dry end within 15 s of it (5:18) and first crack within 20 s (9:29)', async () => {
    const { rows } = await simulateAutoRoast({
      profile: ROAST_16_PROFILE,
      tuning: ROAST_16_TUNING,
      firstCrackAtC: 190.5,
    });
    const reached = (c: number) => rows.find((row) => row.tS > 120 && row.bt >= c)?.tS ?? 0;
    expect(Math.abs(reached(150) - 318)).toBeLessThan(15);
    expect(Math.abs(reached(190.5) - 569)).toBeLessThan(20);
  });
});
