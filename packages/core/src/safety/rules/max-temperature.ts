import { BEAN_TEMP, type SafetyRule } from '../safety-rule';

export const maxTemperatureRule: SafetyRule = {
  id: 'max-temperature',
  action: 'safe-stop',
  isTripped: (state, limits) =>
    (state.history.at(-1)?.values[BEAN_TEMP] ?? Number.NEGATIVE_INFINITY) >= limits.maxTempC,
};
