import {
  needsAttention,
  type PlanCheck,
  type ReportFinding,
  type ReportPhase,
  type RoastReport,
} from '@roastpilot/core';
import {
  diffNumber,
  formatTemp,
  rorSymbol,
  tempSymbol,
  type TemperatureUnit,
} from '@roastpilot/shared';
import { formatClock, type CompareTableRow, type PhaseSplitPart } from '@roastpilot/ui';
import { clockDiff, momentRow, tempDecimals } from '../compare-format';

const PHASE_LABEL: Record<ReportPhase['kind'], string> = {
  drying: 'Drying',
  maillard: 'Maillard',
  development: 'Development',
  'before-crack': 'Before first crack',
};

const PHASE_TONE: Record<ReportPhase['kind'], PhaseSplitPart['tone']> = {
  drying: 'low',
  'before-crack': 'low',
  maillard: 'mid',
  development: 'high',
};

/**
 * Whole percentages that add up to 100: each share rounded down, then the points left over go to
 * the largest remainders, so 33.4 + 33.3 + 33.3 shows 34 + 33 + 33 and never 99 or 101.
 */
export function wholePercents(shares: readonly number[]): number[] {
  const raw = shares.map((s) => s * 100);
  const whole = raw.map(Math.floor);
  const left = 100 - whole.reduce((sum, p) => sum + p, 0);
  const order = raw
    .map((r, i) => ({ i, rest: r - Math.floor(r) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order.slice(0, Math.max(0, left))) whole[i] = (whole[i] ?? 0) + 1;
  return whole;
}

/**
 * The phase split as the bar shows it: each phase's length and share, and BT where it ended. With
 * dry end estimated, the stretches it bounds read "about" (≈).
 */
export function phaseParts(report: RoastReport, unit: TemperatureUnit): PhaseSplitPart[] {
  const percents = wholePercents(report.phases.map((p) => p.share));
  const estimated = report.dryEnd?.estimated === true;
  // Each phase ends at dry end, first crack, or drop (Stop roast).
  const ends = [report.dryEnd, report.firstCrack, report.end];
  return report.phases.map((phase, i) => {
    const end = ends.find((p) => p?.tS === phase.toS);
    const about = estimated && (phase.kind === 'drying' || phase.kind === 'maillard');
    const length = formatClock(phase.toS - phase.fromS);
    const pct = `${String(percents[i] ?? 0)} %`;
    return {
      key: phase.kind,
      label: PHASE_LABEL[phase.kind],
      detail: `${about ? '≈ ' : ''}${length} · ${pct}`,
      spokenDetail: `${about ? 'about ' : ''}${length}, ${pct}`,
      end: end && `to ${formatTemp(end.c, unit, tempDecimals(unit))}`,
      share: phase.share,
      tone: PHASE_TONE[phase.kind],
    };
  });
}

/** Under the bar when dry end wasn't marked: where it was taken from instead. */
export function phaseNote(report: RoastReport): string | undefined {
  const { dryEnd } = report;
  if (dryEnd?.estimated === true)
    return `No dry end marked · taken at ${formatClock(dryEnd.tS)}, where BT first reached the dry-end temperature`;
  if (!dryEnd && report.firstCrack) return 'BT never reached dry end, so drying isn’t split out';
  return undefined;
}

/** RoR with one decimal and its unit: `8.1 °C/min`, `14.6 °F/min`. */
const ror = (c: number, unit: TemperatureUnit) => `${diffNumber(c, unit, 1)} ${rorSymbol(unit)}`;
/** Two RoRs, the unit said once: `9.0 to 2.0 °C/min`. */
const rorFromTo = (from: number, to: number, unit: TemperatureUnit) =>
  `${diffNumber(from, unit, 1)} to ${ror(to, unit)}`;
/** A share as a whole percentage, as the phase split and Development's card show it. */
const pctOf = (share: number) => `${String(Math.round(share * 100))} %`;

/** A stretch of the roast, seconds since charge; `fromS` equal to `toS` is a moment. */
export interface TimeSpan {
  fromS: number;
  toS: number;
}

/** How long after a crash's peak the chart picks out: the minute the fall is measured over. */
const CRASH_SPAN_S = 60;

/**
 * Where on the chart a finding happened, to pick it out there; undefined for one with no time of
 * its own (no first crack).
 */
export function findingSpan(f: ReportFinding, report: RoastReport): TimeSpan | undefined {
  const moment = (tS: number) => ({ fromS: tS, toS: tS });
  switch (f.kind) {
    case 'crash':
      return { fromS: f.atS, toS: Math.min(report.endS, f.atS + CRASH_SPAN_S) };
    case 'flick':
    case 'took-over':
      return { fromS: f.atS, toS: report.endS };
    case 'stall':
      return { fromS: f.atS, toS: f.atS + f.durationS };
    case 'gap':
      return { fromS: f.fromS, toS: f.toS };
    case 'development-share':
      return report.firstCrack ? { fromS: report.firstCrack.tS, toS: report.endS } : undefined;
    case 'stall-guard':
    case 'stopped':
    case 'cap-drop':
    case 'off-plan':
      return moment(f.atS);
    case 'no-first-crack':
      return undefined;
  }
}

export interface FindingText {
  title: string;
  detail: string;
}

/** A finding in a roaster's words: what happened, then the numbers and what it can mean. */
export function findingText(f: ReportFinding, unit: TemperatureUnit): FindingText {
  const at = (tS: number) => formatClock(tS);
  switch (f.kind) {
    case 'crash':
      return {
        title: 'RoR crashed after first crack',
        detail: `Fell from ${rorFromTo(f.fromRor, f.toRor, unit)} within a minute of ${at(f.atS)} · a crash can taste flat or baked`,
      };
    case 'flick':
      return {
        title: 'RoR flicked up before drop',
        detail: `Rose from ${rorFromTo(f.fromRor, f.toRor, unit)} from ${at(f.atS)} · a flick can taste roasty or smoky`,
      };
    case 'stall':
      return {
        title: 'RoR stalled before first crack',
        detail: [
          `Down to ${ror(f.minRor, unit)} for ${formatClock(f.durationS)} from ${at(f.atS)}`,
          f.guarded ? 'Auto’s stall guard added heat' : 'a stall can taste flat or bready',
        ].join(' · '),
      };
    case 'stall-guard':
      return {
        title: 'Auto’s stall guard stepped in',
        detail:
          f.times === 1
            ? `At ${at(f.atS)} · RoR picked up, no stall followed`
            : `${String(f.times)} times, first at ${at(f.atS)} · no stall followed`,
      };
    case 'no-first-crack':
      return {
        title: 'No first crack marked',
        detail: 'Development and its share can’t be measured without it',
      };
    case 'stopped':
      return {
        title: 'Stopped before drop',
        detail: `Stop roast at ${at(f.atS)} · the report runs to there`,
      };
    case 'took-over':
      return {
        title: `You took over at ${at(f.atS)}`,
        detail: 'The comparison with the plan stops there',
      };
    case 'gap':
      return {
        title: 'Readings missing',
        detail: `No BT from ${at(f.fromS)} to ${at(f.toS)} · RoR isn’t checked across it`,
      };
    case 'cap-drop':
      return {
        title: 'Dropped at the BT cap',
        detail: `Reached ${formatTemp(f.capC, unit, tempDecimals(unit))} at ${at(f.atS)}, ${formatClock(f.shortS)} before the planned development ended`,
      };
    case 'development-share':
      return f.side === 'short'
        ? {
            title: 'Short development',
            detail: `${pctOf(f.share)} of the roast came after first crack · it can taste sour or grassy`,
          }
        : {
            title: 'Long development',
            detail: `${pctOf(f.share)} of the roast came after first crack · it can taste flat or roasty`,
          };
    case 'off-plan': {
      const by = `${diffNumber(Math.abs(f.byC), unit, 0)} ${tempSymbol(unit)}`;
      return {
        title: `BT ran up to ${by} ${f.byC > 0 ? 'over' : 'under'} the plan`,
        detail: `Furthest from it around ${at(f.atS)}`,
      };
    }
  }
}

/**
 * An Auto roast against its plan, as the comparison table's rows: this roast, the plan, and this
 * roast minus the plan. After you took over, this roast's side is blank.
 */
export function planRows(plan: PlanCheck, unit: TemperatureUnit): CompareTableRow[] {
  const { actual, plan: planned } = plan.developmentS;
  return [
    momentRow('Dry end', plan.dryEnd.actual, plan.dryEnd.plan, unit),
    momentRow('First crack', plan.firstCrack.actual, plan.firstCrack.plan, unit),
    {
      label: 'Development',
      own: actual === undefined ? undefined : formatClock(actual),
      other: formatClock(planned),
      diff: actual === undefined ? undefined : clockDiff(actual, planned),
    },
    momentRow('Drop', plan.drop.actual, plan.drop.plan, unit),
  ];
}

/**
 * The report's line while folded: the phase shares, then the first thing worth a look (and how many
 * more), the number of notes, or that nothing stood out.
 */
export function reportSummary(report: RoastReport, unit: TemperatureUnit): string {
  const percents = wholePercents(report.phases.map((p) => p.share));
  const phases = report.phases.map(
    (p, i) => `${PHASE_LABEL[p.kind]} ${String(percents[i] ?? 0)} %`,
  );
  const attention = report.findings.filter(needsAttention);
  const notes = report.findings.length - attention.length;
  const first = attention[0];
  const verdict = first
    ? [
        findingText(first, unit).title,
        attention.length > 1 ? `${String(attention.length - 1)} more` : undefined,
      ]
        .filter(Boolean)
        .join(' + ')
    : notes > 0
      ? `${String(notes)} ${notes === 1 ? 'note' : 'notes'}`
      : 'Nothing stood out';
  return [...phases, verdict].join(' · ');
}
