import type { Reading } from '@roastpilot/shared';
import { rateOfRise } from '../roast/rate-of-rise';

/** Which way RoR is heading, for the coach's reason line. */
export type RorTrend = 'rising' | 'falling' | 'steady';

/**
 * How the trend is read: RoR now against RoR `lookBackMs` ago. A change under `deadBandC`
 * (°C/min) either way is steady, so the probe's noise doesn't flip the word every reading; 1 °C/min
 * in 20 s is about what a heater step of 10 % moves it on the Skywalker.
 */
export const ROR_TREND = { lookBackMs: 20_000, deadBandC: 1 } as const;

/**
 * Rising, falling or steady (docs/spec/manual-mode.md, Coach), from the readings RoR may use (since
 * charge). Undefined until there is an RoR both now and `lookBackMs` ago.
 */
export function rorTrend(readings: readonly Reading[]): RorTrend | undefined {
  const latest = readings.at(-1);
  if (!latest) return undefined;
  const now = rateOfRise(readings);
  const thenMs = latest.atMs - ROR_TREND.lookBackMs;
  const then = rateOfRise(readings.filter((r) => r.atMs <= thenMs));
  if (now === undefined || then === undefined) return undefined;
  const change = now - then;
  if (change >= ROR_TREND.deadBandC) return 'rising';
  if (change <= -ROR_TREND.deadBandC) return 'falling';
  return 'steady';
}
