import type { TasteTag } from '@roastpilot/shared';
import type { TasteField, TasteInput, TasteRule, TasteSuggestion } from './taste-rule';

/**
 * The taste table's numbers (docs/spec/beans-favourites-ghost.md, The suggestion): starting
 * guesses, to revisit once there are tasted roasts to compare.
 */
export const TASTE = {
  devStepS: 15,
  capStepC: 3,
  chargeStepC: 5,
  /** Under this much development, a bitter cup drops cooler instead of shorter. */
  shortDevelopmentS: 60,
  /** At or above this share of the roast, a sour cup is not under-developed. */
  developedShare: 0.2,
} as const;

const UNDER: readonly TasteTag[] = ['sour', 'grassy', 'thin'];
const OVER: readonly TasteTag[] = ['bitter', 'roasty'];
const FLAT: readonly TasteTag[] = ['flat', 'baked'];

const hasAny = (tags: ReadonlySet<TasteTag>, group: readonly TasteTag[]): boolean =>
  group.some((tag) => tags.has(tag));

const asks = (tags: ReadonlySet<TasteTag>): boolean =>
  hasAny(tags, UNDER) || hasAny(tags, OVER) || hasAny(tags, FLAT);

/** The change from the profile's current value; the rules' caller checks the limits. */
function change(
  input: TasteInput,
  field: TasteField,
  by: number,
  reason: TasteSuggestion['reason'],
): TasteSuggestion | undefined {
  if (!input.profile) return undefined;
  const from = input.profile[field];
  return { kind: 'change', change: { field, from, to: from + by }, reason };
}

/** Judged as the report shows it, a whole percentage: 19.6 % reads 20 %. */
const shownShare = (share: number): number => Math.round(share * 100) / 100;

/** Sweet and balanced, nothing else: it's right; star it to roast it again. */
export const balancedRule: TasteRule = {
  id: 'balanced',
  suggest: ({ tags }) =>
    tags.has('balanced') && !asks(tags)
      ? { kind: 'none', reason: { kind: 'balanced' }, offerStar: true }
      : undefined,
};

/** Under and over at once: change one thing at a time. */
export const mixedRule: TasteRule = {
  id: 'mixed',
  suggest: ({ tags }) =>
    hasAny(tags, UNDER) && hasAny(tags, OVER)
      ? { kind: 'none', reason: { kind: 'mixed' } }
      : undefined,
};

/** Every change is to the profile the roast ran: without one, roast on Auto first. */
export const needsProfileRule: TasteRule = {
  id: 'needs-profile',
  suggest: ({ tags, profile }) =>
    asks(tags) && !profile ? { kind: 'none', reason: { kind: 'needs-auto' } } : undefined,
};

/** Bitter or roasty: shorter development, or a cooler drop when development was short already. */
export const overRule: TasteRule = {
  id: 'over',
  suggest: (input) => {
    if (!hasAny(input.tags, OVER)) return undefined;
    if (input.developmentS === undefined)
      return { kind: 'none', reason: { kind: 'no-first-crack' } };
    return input.developmentS >= TASTE.shortDevelopmentS
      ? change(input, 'devTimeS', -TASTE.devStepS, { kind: 'over-developed' })
      : change(input, 'capC', -TASTE.capStepC, { kind: 'drop-cooler' });
  },
};

/** Sour, grassy or thin: longer development, unless development is already a large share. */
export const underRule: TasteRule = {
  id: 'under',
  suggest: (input) => {
    if (!hasAny(input.tags, UNDER)) return undefined;
    const share = input.developmentShare;
    if (share === undefined) return { kind: 'none', reason: { kind: 'no-first-crack' } };
    return shownShare(share) < TASTE.developedShare
      ? change(input, 'devTimeS', TASTE.devStepS, { kind: 'under-developed' })
      : { kind: 'none', reason: { kind: 'already-developed', share } };
  },
};

/** Flat or baked: point at a stall or crash the report found, else more heat early. */
export const flatRule: TasteRule = {
  id: 'flat',
  suggest: (input) => {
    if (!hasAny(input.tags, FLAT)) return undefined;
    const finding = input.findings.find((f) => f.kind === 'stall' || f.kind === 'crash');
    if (finding?.kind === 'stall' || finding?.kind === 'crash') {
      return {
        kind: 'none',
        reason: { kind: 'after-finding', finding: finding.kind, atS: finding.atS },
      };
    }
    if (input.totalS === undefined) return undefined;
    return change(input, 'chargeC', TASTE.chargeStepC, {
      kind: 'slow-roast',
      totalS: input.totalS,
    });
  },
};

/** The table's rows, in order: the first with something to say wins. */
export const TASTE_RULES: readonly TasteRule[] = [
  balancedRule,
  mixedRule,
  needsProfileRule,
  overRule,
  underRule,
  flatRule,
];
