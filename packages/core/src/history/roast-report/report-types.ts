/**
 * What a finished roast's report holds (docs/spec/roast-report.md). Times are seconds since charge,
 * temperatures °C, RoR °C/min: the screen says them in its unit.
 */

/** The numbers in docs/spec/roast-report.md, in one place. */
export const REPORT = {
  /** A roast shorter than this from charge to drop (or Stop roast) has too little to report on. */
  minRoastS: 120,
  /** Fewer BT readings than this between charge and the end, and there is nothing to measure. */
  minReadings: 30,
  /** Readings further apart than this are a gap: RoR across it isn't trusted. */
  maxGapS: 10,
  /** Crash: after first crack, RoR falls by at least this share of where it was… */
  crashFallShare: 0.5,
  /** …and by at least this much, °C/min… */
  crashMinFallRor: 4,
  /** …within this long. */
  crashWithinS: 60,
  /** Flick: RoR rises at least this far above its lowest point since first crack… */
  flickRiseRor: 1.5,
  /** …and stays up this long. Measured from this long after first crack, past its own bump. */
  flickHoldS: 15,
  flickFromCrackS: 30,
  /** Stall: before first crack, RoR stays under this… */
  stallRor: 3,
  /** …for this long. */
  stallHoldS: 30,
  /** Development under or over these shares of the roast, as a whole percentage, gets a note. */
  shortDevelopmentShare: 0.1,
  longDevelopmentShare: 0.25,
  /** BT this far or further from an Auto roast's plan gets a note. */
  offPlanC: 5,
  /** …counted from this long after the turning point: before it the plan only sketches the dip. */
  planFromTurnS: 60,
  /** An Auto drop this close to the profile's BT cap, and this much short of its development… */
  capSlackC: 0.5,
  devShortfallS: 5,
} as const;

export interface ReportPoint {
  tS: number;
  c: number;
}

export type ReportPhaseKind = 'drying' | 'maillard' | 'development' | 'before-crack';

/** A stretch of the roast: Drying, Maillard and Development; Before first crack with no dry end. */
export interface ReportPhase {
  kind: ReportPhaseKind;
  fromS: number;
  toS: number;
  /** Its part of charge to the end, 0–1. */
  share: number;
}

/** Something about the roast worth a line, each kind with the numbers its sentence needs. */
export type ReportFinding =
  | { kind: 'crash'; atS: number; fromRor: number; toRor: number }
  | { kind: 'flick'; atS: number; fromRor: number; toRor: number }
  | { kind: 'stall'; atS: number; durationS: number; minRor: number; guarded: boolean }
  /** Auto's stall guard added heat, and no stall followed. */
  | { kind: 'stall-guard'; atS: number; times: number }
  | { kind: 'no-first-crack' }
  | { kind: 'stopped'; atS: number }
  | { kind: 'took-over'; atS: number }
  | { kind: 'gap'; fromS: number; toS: number }
  /** Auto dropped at the BT cap, `shortS` before its planned development ended. */
  | { kind: 'cap-drop'; atS: number; capC: number; shortS: number }
  | { kind: 'development-share'; share: number; side: 'short' | 'long' }
  /** BT's furthest from the plan: `byC` above it when positive. */
  | { kind: 'off-plan'; atS: number; byC: number };

export type ReportFindingKind = ReportFinding['kind'];

/** One moment against the plan. */
export interface PlanMoment {
  actual: ReportPoint | undefined;
  plan: ReportPoint | undefined;
}

/** An Auto roast against its profile's planned curve, up to drop or until you took over. */
export interface PlanCheck {
  dryEnd: PlanMoment;
  firstCrack: PlanMoment;
  drop: PlanMoment;
  developmentS: { actual: number | undefined; plan: number };
  /** BT's furthest from the plan, signed (above the plan when positive); undefined with no overlap. */
  furthest: { atS: number; byC: number } | undefined;
  /** The comparison stops here: drop, Stop roast, or when you took over. */
  untilS: number;
}

export interface RoastReport {
  /** Drop, or Stop roast. */
  endS: number;
  /** BT there: drop's temperature as saved, else read from the samples. */
  end: ReportPoint | undefined;
  stopped: boolean;
  /** In order; empty when neither dry end nor first crack can be placed. */
  phases: ReportPhase[];
  turningPoint: ReportPoint | undefined;
  /** Marked by Auto, or estimated where BT first reached the dry-end temperature. */
  dryEnd: (ReportPoint & { estimated: boolean }) | undefined;
  firstCrack: ReportPoint | undefined;
  /** Auto roasts with their profile only. */
  plan: PlanCheck | undefined;
  /** What to look at first, then notes, each in time order. */
  findings: ReportFinding[];
}

const ATTENTION: ReadonlySet<ReportFindingKind> = new Set([
  'crash',
  'flick',
  'stall',
  'no-first-crack',
  'gap',
]);

/** Worth a look before the next roast, rather than a note on how it went. */
export const needsAttention = (finding: ReportFinding): boolean => ATTENTION.has(finding.kind);
