import type { ThermalInputs } from './thermal-model';

/**
 * The air in the drum, for the Simulator's ET (docs/spec/hardware.md, Simulator). Not fitted to
 * anything: no saved roast has an ET yet. Picked so ET leads BT when the heater changes, sits a few
 * degrees above it in a steady preheat and while the drum heats, and dips far less than BT at charge.
 */
export interface EnvironmentConstants {
  /** °C the air runs above the drum at heater 100 with the fan off. */
  heaterLiftC: number;
  /** Share of that lift fan 100 blows away (0–1). */
  fanLiftCut: number;
  /** How slowly the air follows the heater, in seconds (time constant). */
  lagS: number;
  /** How quickly the air follows the drum's metal as it heats, in seconds. */
  drumRiseLagS: number;
  /** How slowly it follows the metal cooling, in seconds: the beans cool the metal, not the flame. */
  drumLagS: number;
}

export const DEFAULT_ENVIRONMENT_CONSTANTS: EnvironmentConstants = {
  heaterLiftC: 25,
  fanLiftCut: 0.5,
  lagS: 8,
  drumRiseLagS: 15,
  drumLagS: 90,
};

/**
 * The air: `baseC` follows the drum (quickly as it heats, slowly as it cools), `etC` follows base
 * plus the heater's lift quickly.
 */
export interface EnvironmentTemps {
  baseC: number;
  etC: number;
}

/** The heater's lift over the drum, less what the fan blows away. */
export function heaterLiftC(inputs: ThermalInputs, constants: EnvironmentConstants): number {
  const lift = (constants.heaterLiftC * inputs.heater) / 100;
  return lift * (1 - (constants.fanLiftCut * inputs.fan) / 100);
}

/** Advances the air by `dtS` seconds over a drum at `drumC`. */
export function stepEnvironment(
  temps: EnvironmentTemps,
  drumC: number,
  inputs: ThermalInputs,
  constants: EnvironmentConstants,
  dtS: number,
): EnvironmentTemps {
  const lagS = drumC > temps.baseC ? constants.drumRiseLagS : constants.drumLagS;
  const baseC = temps.baseC + (drumC - temps.baseC) * Math.min(1, dtS / lagS);
  const target = baseC + heaterLiftC(inputs, constants);
  return { baseC, etC: temps.etC + (target - temps.etC) * Math.min(1, dtS / constants.lagS) };
}
