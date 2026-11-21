import type { AutoProfile, TasteTag } from '@roastpilot/shared';
import type { ReportFinding } from '../history/roast-report/report-types';

/** The profile values a taste suggestion may change (docs/spec/beans-favourites-ghost.md). */
export type TasteField = 'devTimeS' | 'capC' | 'chargeC';

/** One change to the profile the roast ran: the value now and the value suggested. */
export interface TasteChange {
  field: TasteField;
  from: number;
  to: number;
}

/** Why a suggestion says what it says; each kind carries the numbers its line needs. */
export type TasteReason =
  | { kind: 'balanced' }
  | { kind: 'mixed' }
  | { kind: 'over-developed' }
  | { kind: 'drop-cooler' }
  | { kind: 'under-developed' }
  /** Development already a large share of the roast: grind and brew first. */
  | { kind: 'already-developed'; share: number }
  /** Flat or baked after a stall or crash the report found. */
  | { kind: 'after-finding'; finding: 'stall' | 'crash'; atS: number }
  /** Flat or baked in a slow roast, `totalS` from charge to drop. */
  | { kind: 'slow-roast'; totalS: number }
  /** Development can't be judged without a first crack. */
  | { kind: 'no-first-crack' }
  /** A manual roast, or one whose profile wasn't saved. */
  | { kind: 'needs-auto' }
  /** The change would leave the profile's limits: `from` is as far as it goes. */
  | { kind: 'at-limit'; field: TasteField; from: number; to: number };

/** A change to make, with why; or none, with why not. */
export type TasteSuggestion =
  | { kind: 'change'; change: TasteChange; reason: TasteReason }
  | { kind: 'none'; reason: TasteReason; offerStar?: boolean };

/** What the rules read: the ticked tags and the roast as measured. */
export interface TasteInput {
  tags: ReadonlySet<TasteTag>;
  /** The profile the roast ran; undefined for a manual roast or one without its copy. */
  profile: AutoProfile | undefined;
  /** First crack to drop, seconds; undefined without both. */
  developmentS: number | undefined;
  /** Development's part of charge to drop, 0–1; undefined without both. */
  developmentShare: number | undefined;
  /** Charge to drop (or Stop roast), seconds; undefined without an end. */
  totalS: number | undefined;
  findings: readonly ReportFinding[];
}

/**
 * One row of the taste table (docs/spec/extensibility.md, Taste suggestion). Rules run in order
 * and the first with something to say wins.
 */
export interface TasteRule {
  readonly id: string;
  suggest(input: TasteInput): TasteSuggestion | undefined;
}
