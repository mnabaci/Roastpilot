/**
 * Fitted by `pnpm fit:simulator 6 7 15 16` to manual roasts 6 and 7 of 2026-11-04 (375 g) and Auto
 * roasts 15 and 16 of 2026-11-08 (356 g), readings with beans in counting 20 times: replayed
 * open-loop, RMS error from charge to drop 4.5 → 2.9 °C (every reading 9.8 → 10.1 °C). A closed-loop
 * Auto roast with roast 16's profile and gains is within 3 °C of it every 30 s from 1:00 to drop
 * (RMS 4.0 → 1.6 °C; roast 15 6.8 → 2.7 °C), dry end within 15 s and first crack within 20 s
 * (docs/spec/hardware.md, Simulator).
 */
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
  heatGainCPerS: 0.635,
  roomLossPerS: 0.000183,
  fanLossFactor: 3.86,
  coolingLossFactor: 13.8,
  beanGainPerS: 0.0107,
  drumToBeansPerS: 0.0098,
  probeLagS: 38,
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

/**
 * Beans out. The probe reads the drum again, but never hotter than it read with the beans in: a
 * reading doesn't jump in a moment, and the real Skywalker falls from its drop temperature
 * (docs/spec/hardware.md, Simulator). The drum carries on from there, so a heater left on still
 * heats it.
 */
export function removeBeans(temps: RoasterTemps): RoasterTemps {
  const drumC = Math.min(temps.drumC, temps.probeC);
  return { drumC, beansC: undefined, probeC: drumC };
}
