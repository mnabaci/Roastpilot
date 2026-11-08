import {
  err,
  MilestonesSchema,
  ok,
  sayInUnit,
  tempPlain,
  type Milestones,
  type Result,
  type TemperatureUnit,
} from '@roastpilot/shared';
import { formatClock } from '@roastpilot/ui';
import { reader } from '../../lib/draft-reader';
import { unitReader, type ExactValues } from '../../lib/unit-reader';
import type { DraftErrors, PointDraft } from './profile-draft';

export const MILESTONE_ROWS = ['turningPoint', 'dryEnd', 'firstCrack', 'drop'] as const;
export type MilestoneRow = (typeof MILESTONE_ROWS)[number];

/**
 * The milestone builder's table as typed (docs/spec/roast-control.md, Milestone builder), its
 * temperatures in `unit`.
 */
export interface MilestoneDraft {
  unit: TemperatureUnit;
  /** The milestones' own °C values, so an untouched cell reads back exactly. */
  exact: ExactValues;
  chargeC: string;
  rows: Record<MilestoneRow, PointDraft>;
  extras: PointDraft[];
}

export function toMilestoneDraft(m: Milestones, unit: TemperatureUnit): MilestoneDraft {
  const asDraft = (p: { tS: number; c: number }): PointDraft => ({
    time: formatClock(p.tS),
    c: tempPlain(p.c, unit),
  });
  const points = [m.turningPoint, m.dryEnd, m.firstCrack, m.drop, ...m.extras];
  return {
    unit,
    exact: { temps: [m.chargeC, ...points.map((p) => p.c)], rates: [] },
    chargeC: tempPlain(m.chargeC, unit),
    rows: {
      turningPoint: asDraft(m.turningPoint),
      dryEnd: asDraft(m.dryEnd),
      firstCrack: asDraft(m.firstCrack),
      drop: asDraft(m.drop),
    },
    extras: m.extras.map(asDraft),
  };
}

/** The cell a schema issue belongs to, e.g. `dryEnd.time` or `extras.0.c`. */
function cellOf(path: readonly PropertyKey[]): string {
  const cell = path.map((part) => (part === 'tS' ? 'time' : String(part)));
  return cell.join('.');
}

/** The milestones a draft makes, in °C, or a message per cell in the draft's unit. */
export function fromMilestoneDraft(draft: MilestoneDraft): Result<Milestones, DraftErrors> {
  const read = unitReader(draft.unit, draft.exact);
  const point = (key: string, p: PointDraft) => ({
    tS: read.clock(`${key}.time`, p.time),
    c: read.temp(`${key}.c`, p.c),
  });
  const candidate = {
    chargeC: read.temp('chargeC', draft.chargeC),
    turningPoint: point('turningPoint', draft.rows.turningPoint),
    dryEnd: point('dryEnd', draft.rows.dryEnd),
    firstCrack: point('firstCrack', draft.rows.firstCrack),
    drop: point('drop', draft.rows.drop),
    extras: draft.extras.map((p, i) => point(`extras.${String(i)}`, p)),
  };
  if (Object.keys(read.errors).length > 0) return err(read.errors);
  const parsed = MilestonesSchema.safeParse(candidate);
  if (parsed.success) return ok(parsed.data);
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    errors[cellOf(issue.path)] ??= sayInUnit(issue.message, draft.unit);
  }
  return err(errors);
}

/**
 * A point of your own halfway to first crack from the last point before it, to adjust; in the
 * draft's unit, as typed.
 */
export function addMilestonePoint(draft: MilestoneDraft): MilestoneDraft {
  const read = reader();
  const at = (p: PointDraft) => ({ tS: read.clock('t', p.time), c: read.number('c', p.c) });
  const crack = at(draft.rows.firstCrack);
  const from = [draft.rows.dryEnd, ...draft.extras]
    .map(at)
    .filter((p) => p.tS < crack.tS)
    .reduce<{ tS: number; c: number } | undefined>(
      (last, p) => (last && last.tS >= p.tS ? last : p),
      undefined,
    );
  const halfway =
    !from || Object.keys(read.errors).length > 0
      ? { time: '', c: '' }
      : {
          time: formatClock(Math.round((from.tS + crack.tS) / 2)),
          c: String(Math.round((from.c + crack.c) / 2)),
        };
  return { ...draft, extras: [...draft.extras, halfway] };
}

export function removeMilestonePoint(draft: MilestoneDraft, index: number): MilestoneDraft {
  return { ...draft, extras: draft.extras.filter((_, i) => i !== index) };
}
