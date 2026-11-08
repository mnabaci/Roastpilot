import { minimise } from './nelder-mead';
import {
  removeBeans,
  stepRoaster,
  type RoasterTemps,
  type ThermalConstants,
  type ThermalInputs,
} from './thermal-model';

/** One saved reading with the outputs at that moment and whether beans were in the drum. */
export interface FitSample extends ThermalInputs {
  tS: number;
  bt: number;
  beans: boolean;
}

/** The constants the fit changes; ambient stays as given. */
export const FITTED_KEYS = [
  'heatGainCPerS',
  'roomLossPerS',
  'fanLossFactor',
  'coolingLossFactor',
  'beanGainPerS',
  'drumToBeansPerS',
  'probeLagS',
] as const satisfies readonly (keyof ThermalConstants)[];

const MAX_STEP_S = 0.5;

/**
 * Replays a roast through the model: starts at the first reading, then feeds each reading's
 * outputs and bean state until the next one. Returns the probe temperature at every reading.
 */
export function replayRoast(samples: readonly FitSample[], constants: ThermalConstants): number[] {
  const first = samples[0];
  if (!first) return [];
  let temps: RoasterTemps = { drumC: first.bt, beansC: undefined, probeC: first.bt };
  const probe: number[] = [first.bt];
  let prev = first;
  for (const next of samples.slice(1)) {
    if (prev.beans && temps.beansC === undefined) temps = { ...temps, beansC: constants.ambientC };
    if (!prev.beans && temps.beansC !== undefined) temps = removeBeans(temps);
    const gapS = next.tS - prev.tS;
    const steps = Math.max(1, Math.ceil(gapS / MAX_STEP_S));
    for (let s = 0; s < steps; s++) temps = stepRoaster(temps, prev, constants, gapS / steps);
    probe.push(temps.probeC);
    prev = next;
  }
  return probe;
}

/**
 * Readings with beans in count this many times more than preheat and cooling ones: the fit is for
 * roasting, and a fit led by the long preheat and cooling ran fast early and stalled late in a
 * closed-loop Auto roast (docs/spec/hardware.md, Simulator).
 */
export const BEANS_IN_WEIGHT = 20;

/** How much a reading counts in `fitError`, with beans in and in preheat or cooling. */
export interface ReadingWeights {
  beansIn: number;
  other: number;
}

const FIT_WEIGHTS: ReadingWeights = { beansIn: BEANS_IN_WEIGHT, other: 1 };
/** Every reading the same. */
export const EVERY_READING: ReadingWeights = { beansIn: 1, other: 1 };
/** Charge to drop only. */
export const BEANS_IN_ONLY: ReadingWeights = { beansIn: 1, other: 0 };

/** Weighted root mean square of model minus reading, in °C, over every reading of every roast. */
export function fitError(
  roasts: readonly (readonly FitSample[])[],
  constants: ThermalConstants,
  weights: ReadingWeights = FIT_WEIGHTS,
): number {
  let sum = 0;
  let total = 0;
  for (const samples of roasts) {
    const probe = replayRoast(samples, constants);
    samples.forEach((sample, i) => {
      const weight = sample.beans ? weights.beansIn : weights.other;
      sum += weight * ((probe[i] ?? sample.bt) - sample.bt) ** 2;
      total += weight;
    });
  }
  return total === 0 ? 0 : Math.sqrt(sum / total);
}

export interface ThermalFit {
  constants: ThermalConstants;
  /** RMS error in °C with the starting and with the fitted constants. */
  errorBefore: number;
  errorAfter: number;
}

/**
 * Least-squares fit of the model to saved roasts (docs/spec/hardware.md, Simulator). Searches the
 * logs of the constants, so they stay positive.
 */
export function fitThermalConstants(
  roasts: readonly (readonly FitSample[])[],
  start: ThermalConstants,
  maxEvaluations = 4000,
): ThermalFit {
  const toConstants = (point: readonly number[]): ThermalConstants => ({
    ...start,
    ...Object.fromEntries(FITTED_KEYS.map((key, i) => [key, Math.exp(point[i] ?? 0)])),
  });
  const best = minimise(
    (point) => fitError(roasts, toConstants(point)),
    FITTED_KEYS.map((key) => Math.log(start[key])),
    { maxEvaluations, step: 0.5, tolerance: 1e-9 },
  );
  return {
    constants: toConstants(best.point),
    errorBefore: fitError(roasts, start),
    errorAfter: best.value,
  };
}
