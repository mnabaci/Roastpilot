import { plannedCurve, withSoakTime } from '@roastpilot/core';
import type { CurvePoint, ProfileEntry } from '@roastpilot/shared';
import { useMemo } from 'react';
import { useAuto, useSettings } from '../../stores/use-stores';

/** The chosen profile, or the first one when it is gone; undefined before main has listed them. */
export function activeEntry(
  profiles: readonly ProfileEntry[],
  chosenId: string,
): ProfileEntry | undefined {
  return profiles.find((entry) => entry.profile.id === chosenId) ?? profiles[0];
}

export function useActiveProfile(): ProfileEntry | undefined {
  const profiles = useAuto((s) => s.profiles);
  const chosenId = useSettings((s) => s.settings.autoProfile);
  return activeEntry(profiles, chosenId);
}

/** The dashed curve on the Roast chart: only while Auto is on (docs/spec/ui.md). */
export function useRunningPlan(): readonly CurvePoint[] | undefined {
  const enabled = useAuto((s) => s.status.enabled);
  const soakS = useSettings((s) => s.settings.soakTimeS);
  const entry = useActiveProfile();
  return useMemo(
    () => (enabled && entry ? plannedCurve(withSoakTime(entry.profile, soakS)) : undefined),
    [enabled, entry, soakS],
  );
}
