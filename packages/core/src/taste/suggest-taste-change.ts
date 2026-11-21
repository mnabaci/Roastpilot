import { AutoProfileSchema, type AutoProfile, type RoastDetail } from '@roastpilot/shared';
import type { RoastReport } from '../history/roast-report/report-types';
import type { TasteChange, TasteInput, TasteRule, TasteSuggestion } from './taste-rule';
import { TASTE_RULES } from './taste-rules';

/** What the rules read from a saved roast and its report. */
export function tasteInput(
  detail: Pick<RoastDetail, 'tasteTags' | 'mode' | 'profile' | 'fcTimeS' | 'dropTimeS'>,
  report: Pick<RoastReport, 'endS' | 'findings'> | undefined,
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
  };
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
      const changed = applyTasteChange(input.profile, suggestion.change);
      if (!AutoProfileSchema.safeParse(changed).success) {
        return { kind: 'none', reason: { kind: 'at-limit', ...suggestion.change } };
      }
    }
    return suggestion;
  }
  return undefined;
}
