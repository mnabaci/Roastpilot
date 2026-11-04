/** Hand-picked constants (docs/spec/hardware.md, Simulator). Refit from the first real roast. */
export interface ThermalConstants {
  ambientC: number;
  /** °C per second at heater 100, before losses. */
  heatGainCPerS: number;
  /** Fraction of the gap to ambient lost per second with fan and cooling off. */
  roomLossPerS: number;
  fanLossFactor: number;
  coolingLossFactor: number;
  /** Beans in the drum: fraction of the drum-to-beans gap the beans gain per second. */
  beanGainPerS: number;
  /** The same gap, as the fraction the drum loses per second to the beans. */
  drumToBeansPerS: number;
  /** How slowly the probe follows the bean mass, in seconds (time constant). */
  probeLagS: number;
}

export const DEFAULT_THERMAL_CONSTANTS: ThermalConstants = {
  ambientC: 22,
  heatGainCPerS: 1.5,
  roomLossPerS: 0.0054,
  fanLossFactor: 1,
  coolingLossFactor: 3,
  // Fitted to batch 2 of 2026-11-04 (375 g): charge at 181 °C, turning point near 90 °C after 1:10.
  beanGainPerS: 0.01,
  drumToBeansPerS: 0.002,
  probeLagS: 40,
};

export interface ThermalInputs {
  heater: number;
  fan: number;
  cooling: number;
}

/** Advances the roaster temperature by `dtS` seconds (one Euler step). Outputs are 0–100. */
export function stepTemperature(
  tempC: number,
  inputs: ThermalInputs,
  constants: ThermalConstants,
  dtS: number,
): number {
  const heat = (constants.heatGainCPerS * inputs.heater) / 100;
  const lossRate =
    constants.roomLossPerS *
    (1 +
      (constants.fanLossFactor * inputs.fan) / 100 +
      (constants.coolingLossFactor * inputs.cooling) / 100);
  const loss = lossRate * (tempC - constants.ambientC);
  return tempC + (heat - loss) * dtS;
}

/** The drum, the beans in it (if any) and what the probe reads. */
export interface RoasterTemps {
  drumC: number;
  beansC: number | undefined;
  probeC: number;
}

/**
 * Advances drum, beans and probe by `dtS` seconds. Without beans the probe reads the drum; with
 * beans the drum heats them, loses that heat, and the probe follows the beans with a lag, which
 * gives the dip at charge and the turning point.
 */
export function stepRoaster(
  temps: RoasterTemps,
  inputs: ThermalInputs,
  constants: ThermalConstants,
  dtS: number,
): RoasterTemps {
  const { beansC } = temps;
  let drumC = stepTemperature(temps.drumC, inputs, constants, dtS);
  // No beans: the probe sits in hot air and reads the drum.
  if (beansC === undefined) return { drumC, beansC, probeC: drumC };
  const gap = temps.drumC - beansC;
  drumC -= constants.drumToBeansPerS * gap * dtS;
  const nextBeans = beansC + constants.beanGainPerS * gap * dtS;
  const follow = Math.min(1, dtS / constants.probeLagS);
  return { drumC, beansC: nextBeans, probeC: temps.probeC + (nextBeans - temps.probeC) * follow };
}
