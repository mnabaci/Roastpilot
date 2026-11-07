import { activeRoaster } from '../../stores/roasters-store';
import { useAuto, useRoast, useRoasters } from '../../stores/use-stores';
import { planLine, rorAimLine } from './plan-lines';
import { useActiveProfile, useRunningPlan } from './use-active-profile';

/**
 * In Auto, mid-roast: how far BT is from the plan, and the RoR the phase aims for, for the big
 * numbers (docs/spec/ui.md, Big numbers). Nothing in a manual roast.
 */
export function usePlanLines(
  bt: number | undefined,
  elapsedS: number | undefined,
): { temp?: string; ror?: string } {
  const auto = useAuto((s) => s.status);
  const roast = useRoast((s) => s.roast);
  const plan = useRunningPlan();
  const profile = useActiveProfile()?.profile;
  const curveFollow = activeRoaster(useRoasters((s) => s.roasters))?.tuning.curveFollow;
  const roasting = roast.phase === 'roasting' || roast.phase === 'development';
  if (!auto.enabled || !roasting) return {};
  const temp =
    plan && bt !== undefined && elapsedS !== undefined ? planLine(plan, elapsedS, bt) : undefined;
  // A stopped Auto aims for nothing.
  const ror =
    profile && auto.stopReason === null
      ? rorAimLine(profile, {
          phaseName: auto.phaseName,
          firstCracked: roast.firstCrackAtMs !== null,
          elapsedS,
          btC: bt,
          curveFollow,
        })
      : undefined;
  return { ...(temp ? { temp } : {}), ...(ror ? { ror } : {}) };
}
