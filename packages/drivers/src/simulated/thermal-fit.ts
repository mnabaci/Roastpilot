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

/** Root mean square of model minus reading, in °C, over every reading of every roast. */
export function fitError(
  roasts: readonly (readonly FitSample[])[],
  constants: ThermalConstants,
): number {
  let sum = 0;
  let count = 0;
  for (const samples of roasts) {
    const probe = replayRoast(samples, constants);
    samples.forEach((sample, i) => {
      sum += ((probe[i] ?? sample.bt) - sample.bt) ** 2;
      count++;
    });
  }
  return count === 0 ? 0 : Math.sqrt(sum / count);
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
