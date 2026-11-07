import { roundEta, secondsTo } from './eta';
import type { CoachRule } from './coach-rule';

/** The heads-up comes this long before the expected first crack. */
export const FIRST_CRACK_HEADS_UP_S = 60;

/** "First crack in ~45 s · listen": Roasting, no tap yet, BT within a minute of the expected. */
export const firstCrackSoonRule: CoachRule = {
  id: 'first-crack-soon',
  advise: ({ roastPhase, firstCrackAtMs, expectedFirstCrackC, btC, ror }) => {
    if (roastPhase !== 'roasting' || firstCrackAtMs !== null) return undefined;
    const inS = secondsTo(expectedFirstCrackC, btC, ror);
    if (inS === undefined || inS > FIRST_CRACK_HEADS_UP_S) return undefined;
    return { kind: 'first-crack-soon', inS: roundEta(inS) };
  },
};
