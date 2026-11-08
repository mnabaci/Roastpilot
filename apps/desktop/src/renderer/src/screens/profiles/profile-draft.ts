import { soakLengthS } from '@roastpilot/core';
import {
  AutoProfileSchema,
  diffPlain,
  err,
  ok,
  sayInUnit,
  tempPlain,
  type AutoProfile,
  type ProfilePhase,
  type Result,
  type TemperatureUnit,
} from '@roastpilot/shared';
import { formatClock } from '@roastpilot/ui';
import type { Reader } from '../../lib/draft-reader';
import { unitReader, type ExactValues, type UnitReader } from '../../lib/unit-reader';

/**
 * One editable step, as typed. The soak is kept apart: its length and fan are yours to change.
 * `endC` is in the draft's unit; `rorMin` and `rorMax` are rates in it (°F/min in °F).
 */
export interface StepDraft {
  name: string;
  endC: string;
  time: string;
  rorMin: string;
  rorMax: string;
  heat: string;
  fan: string;
  backup: string;
}

export interface PointDraft {
  time: string;
  c: string;
}

/**
 * A profile as the editor holds it: text as typed, checked on the way out. Temperatures are
 * typed in `unit` and kept in °C (docs/spec/ui.md, Units).
 */
export interface ProfileDraft {
  /** What the temperature cells are typed in. */
  unit: TemperatureUnit;
  /** The profile's own °C values, so an untouched cell reads back exactly. */
  exact: ExactValues;
  name: string;
  batchG: string;
  chargeC: string;
  dryEndC: string;
  devTime: string;
  capC: string;
  /** The soak's length in seconds; null for none, the first step starting at charge. */
  soakS: number | null;
  /** Kept while the soak is off, so it comes back with the same fan. */
  soakFan: string;
  steps: StepDraft[];
  /** The curve after its first point, which is always charge temp at 0:00. */
  points: PointDraft[];
}

/** A step's name, or its place when it has none yet. */
export const stepName = (step: StepDraft, index: number): string =>
  step.name || `Step ${String(index + 1)}`;

/** Which cell a message belongs to, e.g. `capC` or `steps.1.endC`. */
export type DraftErrors = Readonly<Record<string, string>>;

export const isStepProfile = (profile: AutoProfile): boolean =>
  profile.phases.some((phase) => phase.heat.mode === 'target');

function toStep(phase: ProfilePhase, unit: TemperatureUnit): StepDraft {
  const { heat, next } = phase;
  const target = heat.mode === 'target' ? heat : undefined;
  const bt = next.on === 'bt' ? next : undefined;
  const endC = target?.endC ?? bt?.c;
  return {
    name: phase.name,
    endC: endC === undefined ? '' : tempPlain(endC, unit),
    time: target ? formatClock(target.durationS) : '',
    // Rates: × 1.8 in °F, never + 32.
    rorMin: target ? diffPlain(target.rorMin, unit) : '',
    rorMax: target ? diffPlain(target.rorMax, unit) : '',
    heat: 'pct' in heat ? String(heat.pct) : '',
    fan: String(phase.fanPct),
    backup: bt ? formatClock(bt.backupS) : '',
  };
}

/** The fan a soak comes back with when the profile never had one (the built-ins' 30 %). */
const DEFAULT_SOAK_FAN = '30';

/** The profile's opening soak, which ends on time; undefined when it starts without one. */
const soakOf = (profile: AutoProfile): ProfilePhase | undefined =>
  soakLengthS(profile) > 0 ? profile.phases[0] : undefined;

/** Every °C value a profile holds: its temperatures, and its RoR ranges (rates). */
function exactValues({ chargeC, dryEndC, capC, curve, phases }: AutoProfile): ExactValues {
  const temps = [chargeC, dryEndC, capC, ...curve.map((p) => p.c)];
  const rates: number[] = [];
  for (const { heat, next } of phases) {
    if (heat.mode === 'target') {
      temps.push(heat.endC);
      rates.push(heat.rorMin, heat.rorMax);
    }
    if (next.on === 'bt') temps.push(next.c);
  }
  return { temps, rates };
}

export function toDraft(profile: AutoProfile, unit: TemperatureUnit): ProfileDraft {
  const soak = soakOf(profile);
  const steps = soak ? profile.phases.slice(1) : profile.phases;
  return {
    unit,
    exact: exactValues(profile),
    name: profile.name,
    batchG: String(profile.batchG),
    chargeC: tempPlain(profile.chargeC, unit),
    dryEndC: tempPlain(profile.dryEndC, unit),
    devTime: formatClock(profile.devTimeS),
    capC: tempPlain(profile.capC, unit),
    soakS: soak ? soakLengthS(profile) : null,
    soakFan: soak ? String(soak.fanPct) : DEFAULT_SOAK_FAN,
    steps: steps.map((phase) => toStep(phase, unit)),
    points: profile.curve
      .slice(1)
      .map((p) => ({ time: formatClock(p.tS), c: tempPlain(p.c, unit) })),
  };
}

function toPhase(step: StepDraft, i: number, last: boolean, steps: boolean, read: UnitReader) {
  const key = (cell: string) => `steps.${String(i)}.${cell}`;
  const pct = read.number(key('heat'), step.heat);
  const needsEnd = steps || !last;
  const endC = needsEnd ? read.temp(key('endC'), step.endC) : 0;
  const heat = steps
    ? {
        mode: 'target' as const,
        pct,
        endC,
        durationS: read.clock(key('time'), step.time),
        rorMin: read.rate(key('rorMin'), step.rorMin),
        rorMax: read.rate(key('rorMax'), step.rorMax),
      }
    : { mode: 'follow' as const, pct };
  const next = last
    ? { on: 'end' as const }
    : { on: 'bt' as const, c: endC, backupS: read.clock(key('backup'), step.backup) };
  return {
    name: read.text(key('name'), step.name),
    heat,
    fanPct: read.number(key('fan'), step.fan),
    next,
  };
}

/** The cell a schema issue belongs to, by its path in the profile. */
function cellOf(path: readonly PropertyKey[], soaks: boolean): string {
  const [head, index, part, leaf] = path;
  if (head === 'phases' && typeof index === 'number') {
    if (soaks && index === 0) return 'soakFan';
    const step = `steps.${String(soaks ? index - 1 : index)}`;
    if (part === 'name') return `${step}.name`;
    if (part === 'fanPct') return `${step}.fan`;
    if (part === 'next') return `${step}.${leaf === 'backupS' ? 'backup' : 'endC'}`;
    if (leaf === 'pct') return `${step}.heat`;
    if (leaf === 'durationS') return `${step}.time`;
    if (leaf === 'rorMin' || leaf === 'rorMax' || leaf === 'endC') return `${step}.${leaf}`;
    return `${step}.heat`;
  }
  if (head === 'curve' && typeof index === 'number') {
    return `points.${String(index - 1)}.${part === 'tS' ? 'time' : 'c'}`;
  }
  if (head === 'devTimeS') return 'devTime';
  return typeof head === 'string' ? head : 'name';
}

/** The draft's soak: the base's own, at the length and fan chosen; a fixed 0 % one if it had none. */
function soakPhase(draft: ProfileDraft, base: AutoProfile, read: Reader): ProfilePhase | undefined {
  if (draft.soakS === null) return undefined;
  const kept = soakOf(base);
  return {
    name: kept?.name ?? 'Soak',
    heat: kept?.heat ?? { mode: 'fixed', pct: 0 },
    fanPct: read.number('soakFan', draft.soakFan),
    next: { on: 'time', afterS: draft.soakS },
  };
}

/**
 * The profile a draft makes, or a message per cell in the draft's unit. `base` keeps what the
 * draft doesn't hold.
 */
export function fromDraft(
  draft: ProfileDraft,
  base: AutoProfile,
): Result<AutoProfile, DraftErrors> {
  const read = unitReader(draft.unit, draft.exact);
  const steps = isStepProfile(base);
  const chargeC = read.temp('chargeC', draft.chargeC);
  const soak = soakPhase(draft, base, read);
  const phases = draft.steps.map((step, i) =>
    toPhase(step, i, i === draft.steps.length - 1, steps, read),
  );
  const firstNext = phases[0]?.next;
  if (draft.soakS !== null && firstNext?.on === 'bt' && firstNext.backupS <= draft.soakS) {
    read.errors['steps.0.backup'] ??= 'Must be after the soak';
  }
  const points = draft.points.map((point, i) => ({
    tS: read.clock(`points.${String(i)}.time`, point.time),
    c: read.temp(`points.${String(i)}.c`, point.c),
  }));
  const candidate = {
    ...base,
    name: read.text('name', draft.name),
    batchG: read.number('batchG', draft.batchG),
    chargeC,
    dryEndC: read.temp('dryEndC', draft.dryEndC),
    devTimeS: read.clock('devTime', draft.devTime),
    capC: read.temp('capC', draft.capC),
    curve: [{ tS: 0, c: chargeC }, ...points],
    phases: soak ? [soak, ...phases] : phases,
  };
  if (Object.keys(read.errors).length > 0) return err(read.errors);
  const parsed = AutoProfileSchema.safeParse(candidate);
  if (parsed.success) return ok(parsed.data);
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    errors[cellOf(issue.path, soak !== undefined)] ??= sayInUnit(issue.message, draft.unit);
  }
  return err(errors);
}
