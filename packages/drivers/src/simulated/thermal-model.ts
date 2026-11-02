/** Hand-picked constants (docs/spec/hardware.md, Simulator). Refit from the first real roast. */
export interface ThermalConstants {
  ambientC: number;
  /** °C per second at heater 100, before losses. */
  heatGainCPerS: number;
  /** Fraction of the gap to ambient lost per second with fan and cooling off. */
  roomLossPerS: number;
  fanLossFactor: number;
  coolingLossFactor: number;
}

export const DEFAULT_THERMAL_CONSTANTS: ThermalConstants = {
  ambientC: 22,
  heatGainCPerS: 1.5,
  roomLossPerS: 0.0054,
  fanLossFactor: 1,
  coolingLossFactor: 3,
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
