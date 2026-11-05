import type { AutoProfile } from '@roastpilot/shared';

export interface EndRuleInput {
  profile: AutoProfile;
  /** Seconds since your first-crack tap; undefined until then. */
  sinceFirstCrackS: number | undefined;
  btC: number | undefined;
}

/** One way a roast can end (docs/spec/extensibility.md, End of roast). */
export interface EndRule {
  readonly id: string;
  isDue(input: EndRuleInput): boolean;
}

/** Only your tap starts this timer: nothing else ever counts as a crack. */
export const developmentTimeRule: EndRule = {
  id: 'development-time',
  isDue: ({ profile, sinceFirstCrackS }) =>
    sinceFirstCrackS !== undefined && sinceFirstCrackS >= profile.devTimeS,
};

export const btCapRule: EndRule = {
  id: 'bt-cap',
  isDue: ({ profile, btC }) => btC !== undefined && btC >= profile.capC,
};

export const END_RULES: readonly EndRule[] = [developmentTimeRule, btCapRule];

/** The first rule that says drop now; undefined while the roast should go on. */
export function dueEndRule(input: EndRuleInput, rules = END_RULES): EndRule | undefined {
  return rules.find((rule) => rule.isDue(input));
}
