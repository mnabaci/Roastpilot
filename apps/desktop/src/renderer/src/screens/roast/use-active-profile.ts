import { plannedCurve } from '@roastpilot/core';
import type { AutoProfile, CurvePoint, ProfileEntry } from '@roastpilot/shared';
import { useMemo } from 'react';
import { isAutoDriven } from '../../lib/roast-phases';
import { useAuto, useRoast, useSettings } from '../../stores/use-stores';

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

/** Auto is running a profile, Preheat to Drop: it stays the one you started with. */
export function useProfileLocked(): boolean {
  const auto = useAuto((s) => s.status.enabled);
  const driving = useRoast((s) => isAutoDriven(s.roast.phase));
  return auto && driving;
}

/** The dashed curve on the Roast chart: only while Auto is on (docs/spec/ui.md). */
export function useRunningPlan(): readonly CurvePoint[] | undefined {
  const enabled = useAuto((s) => s.status.enabled);
  const entry = useActiveProfile();
  return useMemo(
    () => (enabled && entry ? plannedCurve(entry.profile) : undefined),
    [enabled, entry],
  );
}

/**
 * The profile this roast follows: the one Auto runs, or in a manual roast the coach's, while the
 * coach is on (ADR 0019); undefined in a manual roast without the coach.
 */
export function useProfileInUse(): AutoProfile | undefined {
  const auto = useAuto((s) => s.status.enabled);
  const coach = useSettings((s) => s.settings.coachInManual);
  const entry = useActiveProfile();
  return auto || coach ? entry?.profile : undefined;
}
