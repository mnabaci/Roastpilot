import type { AutoProfile } from '@roastpilot/shared';

/** What helps you pick a profile: "Built-in", "Needs calibration", both, or nothing. */
export function profileDetail(profile: AutoProfile, builtIn: boolean): string | undefined {
  const parts = [
    builtIn ? 'Built-in' : undefined,
    profile.needsCalibration ? 'Needs calibration' : undefined,
  ];
  const said = parts.filter((part) => part !== undefined);
  return said.length > 0 ? said.join(' · ') : undefined;
}
