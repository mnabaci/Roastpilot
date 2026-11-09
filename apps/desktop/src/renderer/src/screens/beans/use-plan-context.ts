import { activeRoaster } from '../../stores/roasters-store';
import { useAuto, useRoasters, useSettings } from '../../stores/use-stores';
import { activeEntry } from '../roast/use-active-profile';
import type { PlanContext } from './bean-plan';

/** What a bean's plan needs from the app now: the active roaster and its profiles; none without a roaster. */
export function usePlanContext(): PlanContext | undefined {
  const roaster = activeRoaster(useRoasters((s) => s.roasters));
  const profiles = useAuto((s) => s.profiles);
  const autoProfile = useSettings((s) => s.settings.autoProfile);
  if (!roaster) return undefined;
  return { roaster, profiles, autoProfileG: activeEntry(profiles, autoProfile)?.profile.batchG };
}
