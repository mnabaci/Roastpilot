import { roundEta, secondsTo } from './eta';
import type { CoachRule } from './coach-rule';

/** The heads-up comes this long before Drop. */
export const DROP_HEADS_UP_S = 30;

/**
 * In Development: "Drop in ~30 s · 1:45 development" before the profile's development time, or
 * "BT cap 225 °C in ~30 s" when BT reaches the cap first at the current RoR.
 */
export const dropSoonRule: CoachRule = {
  id: 'drop-soon',
  advise: ({ roastPhase, firstCrackAtMs, nowMs, profile, btC, ror }) => {
    if (roastPhase !== 'development' || firstCrackAtMs === null) return undefined;
    const devLeftS = profile.devTimeS - (nowMs - firstCrackAtMs) / 1_000;
    const capInS = secondsTo(profile.capC, btC, ror);
    if (capInS !== undefined && capInS <= DROP_HEADS_UP_S && capInS < devLeftS)
      return { kind: 'cap-soon', inS: roundEta(capInS), capC: profile.capC };
    if (devLeftS > 0 && devLeftS <= DROP_HEADS_UP_S)
      return { kind: 'drop-soon', inS: roundEta(devLeftS), devTimeS: profile.devTimeS };
    return undefined;
  },
};
