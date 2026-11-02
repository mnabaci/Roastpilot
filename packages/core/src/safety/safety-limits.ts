/** Per-roaster safety limits (docs/spec/safety.md). Times in ms, temperatures in °C. */
export interface SafetyLimits {
  maxTempC: number;
  lostConnectionMs: number;
  maxRoastMs: number;
  /** Alarm when the temperature rises less than `minRiseC` over `windowMs` with the heater at `minHeaterPct` or more. */
  slowRise: { windowMs: number; minRiseC: number; minHeaterPct: number };
  /** Alarm when the exact same temperature repeats this long while the heater is on. */
  frozenReadingMs: number;
}

export const DEFAULT_SAFETY_LIMITS: SafetyLimits = {
  maxTempC: 240,
  lostConnectionMs: 3_000,
  maxRoastMs: 20 * 60_000,
  slowRise: { windowMs: 60_000, minRiseC: 1, minHeaterPct: 50 },
  frozenReadingMs: 10_000,
};
