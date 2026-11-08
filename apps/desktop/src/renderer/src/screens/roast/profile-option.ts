import type { ProfileEntry } from '@roastpilot/shared';
import type { SelectOption } from '@roastpilot/ui';

/**
 * A profile as the picker lists it: its name alone, "Built-in" under it, and Needs calibration as
 * a badge, so the state never truncates the name or away (docs/spec/ui.md, Setup card).
 */
export function profileOption({ profile, builtIn }: ProfileEntry): SelectOption<string> {
  return {
    value: profile.id,
    label: profile.name,
    detail: builtIn ? 'Built-in' : undefined,
    badge: profile.needsCalibration ? 'Needs calibration' : undefined,
  };
}
