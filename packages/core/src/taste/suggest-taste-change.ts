import {
  AutoProfileSchema,
  PROFILE_LIMITS,
  type AutoProfile,
  type RoastDetail,
} from '@roastpilot/shared';
import type { RoastReport } from '../history/roast-report/report-types';
import type { TasteChange, TasteInput, TasteRule, TasteSuggestion } from './taste-rule';
import { TASTE_RULES } from './taste-rules';

/** What the rules read from a saved roast and its report. */
export function tasteInput(
  detail: Pick<RoastDetail, 'tasteTags' | 'mode' | 'profile' | 'fcTimeS' | 'dropTimeS'>,
  report: Pick<RoastReport, 'endS' | 'findings'> | undefined,
  /** The roaster it ran on: a BT cap never goes past its own limit. */
  roaster?: { maxTempC: number },
): TasteInput {
  const { fcTimeS, dropTimeS } = detail;
  const developmentS =
    fcTimeS !== null && dropTimeS !== null && dropTimeS > fcTimeS ? dropTimeS - fcTimeS : undefined;
  return {
    tags: new Set(detail.tasteTags ?? []),
    profile: detail.mode === 'auto' ? (detail.profile ?? undefined) : undefined,
    developmentS,
    developmentShare:
      developmentS !== undefined && dropTimeS !== null ? developmentS / dropTimeS : undefined,
    totalS: report?.endS ?? dropTimeS ?? undefined,
    findings: report?.findings ?? [],
    ...(roaster ? { maxTempC: roaster.maxTempC } : {}),
  };
}

/** Whether `to` stays within the bound for `field`: the profile's and the roaster's limits. */
function withinBound({ field, to }: TasteChange, maxTempC: number | undefined): boolean {
  if (field === 'devTimeS')
    return to >= PROFILE_LIMITS.devTimeS.min && to <= PROFILE_LIMITS.devTimeS.max;
  if (field === 'chargeC')
    return to >= PROFILE_LIMITS.chargeC.min && to <= PROFILE_LIMITS.chargeC.max;
  return to <= PROFILE_LIMITS.capC.max && (maxTempC === undefined || to <= maxTempC);
}

/** The profile with the one change made. */
export const applyTasteChange = (
  profile: AutoProfile,
  { field, to }: TasteChange,
): AutoProfile => ({
  ...profile,
  [field]: to,
});

/**
 * One change for the next roast from a roast's taste (docs/spec/beans-favourites-ghost.md, The
 * suggestion), or none with why not; undefined with no tags ticked. A change the profile's own
 * rules would refuse is not made: it says the limit instead.
 */
export function suggestTasteChange(
  input: TasteInput,
  rules: readonly TasteRule[] = TASTE_RULES,
): TasteSuggestion | undefined {
  if (input.tags.size === 0) return undefined;
  for (const rule of rules) {
    const suggestion = rule.suggest(input);
    if (!suggestion) continue;
    if (suggestion.kind === 'change' && input.profile) {
      // As far as the value goes: the profile's limits, and the roaster's for the BT cap.
      if (!withinBound(suggestion.change, input.maxTempC))
        return { kind: 'none', reason: { kind: 'at-limit', ...suggestion.change } };
      // Within its bounds but against the profile's other rules: a step or curve point in the way.
      const changed = applyTasteChange(input.profile, suggestion.change);
      if (!AutoProfileSchema.safeParse(changed).success)
        return { kind: 'none', reason: { kind: 'clashes', field: suggestion.change.field } };
    }
    return suggestion;
  }
  return undefined;
}
