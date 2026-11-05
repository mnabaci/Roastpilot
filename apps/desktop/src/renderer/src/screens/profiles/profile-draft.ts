import {
  AutoProfileSchema,
  err,
  ok,
  type AutoProfile,
  type ProfilePhase,
  type Result,
} from '@roastpilot/shared';
import { formatClock } from '@roastpilot/ui';

/** One editable step, as typed. Soak is kept apart: only its fan is yours to change here. */
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

/** A profile as the editor holds it: text as typed, checked on the way out. */
export interface ProfileDraft {
  name: string;
  batchG: string;
  chargeC: string;
  dryEndC: string;
  devTime: string;
  capC: string;
  soakFan: string;
  steps: StepDraft[];
  /** The curve after its first point, which is always charge temp at 0:00. */
  points: PointDraft[];
}

/** Which cell a message belongs to, e.g. `capC` or `steps.1.endC`. */
export type DraftErrors = Readonly<Record<string, string>>;

export const isStepProfile = (profile: AutoProfile): boolean =>
  profile.phases.some((phase) => phase.heat.mode === 'target');

function toStep(phase: ProfilePhase): StepDraft {
  const { heat, next } = phase;
  const target = heat.mode === 'target' ? heat : undefined;
  const bt = next.on === 'bt' ? next : undefined;
  return {
    name: phase.name,
    endC: String(target?.endC ?? bt?.c ?? ''),
    time: target ? formatClock(target.durationS) : '',
    rorMin: target ? String(target.rorMin) : '',
    rorMax: target ? String(target.rorMax) : '',
    heat: 'pct' in heat ? String(heat.pct) : '',
    fan: String(phase.fanPct),
    backup: bt ? formatClock(bt.backupS) : '',
  };
}

export function toDraft(profile: AutoProfile): ProfileDraft {
  const [soak, ...steps] = profile.phases;
  return {
    name: profile.name,
    batchG: String(profile.batchG),
    chargeC: String(profile.chargeC),
    dryEndC: String(profile.dryEndC),
    devTime: formatClock(profile.devTimeS),
    capC: String(profile.capC),
    soakFan: String(soak?.fanPct ?? ''),
    steps: steps.map(toStep),
    points: profile.curve.slice(1).map((p) => ({ time: formatClock(p.tS), c: String(p.c) })),
  };
}

/** Reads the typed cells, collecting a message per cell that isn't what it should be. */
function reader() {
  const errors: Record<string, string> = {};
  return {
    errors,
    number(key: string, text: string): number {
      const value = Number(text.trim());
      if (text.trim() === '' || !Number.isFinite(value)) errors[key] = 'Enter a number';
      return value;
    },
    clock(key: string, text: string): number {
      const match = /^(\d+):([0-5]\d)$/.exec(text.trim());
      if (!match) errors[key] = 'Enter a time like 1:30';
      return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
    },
    text(key: string, text: string): string {
      if (text.trim() === '') errors[key] = 'Enter a name';
      return text.trim();
    },
  };
}

type Reader = ReturnType<typeof reader>;

function toPhase(step: StepDraft, i: number, last: boolean, steps: boolean, read: Reader) {
  const key = (cell: string) => `steps.${String(i)}.${cell}`;
  const pct = read.number(key('heat'), step.heat);
  const needsEnd = steps || !last;
  const endC = needsEnd ? read.number(key('endC'), step.endC) : 0;
  const heat = steps
    ? {
        mode: 'target' as const,
        pct,
        endC,
        durationS: read.clock(key('time'), step.time),
        rorMin: read.number(key('rorMin'), step.rorMin),
        rorMax: read.number(key('rorMax'), step.rorMax),
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
function cellOf(path: readonly PropertyKey[]): string {
  const [head, index, part, leaf] = path;
  if (head === 'phases' && typeof index === 'number') {
    const step = `steps.${String(index - 1)}`;
    if (index === 0) return 'soakFan';
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

/** The profile a draft makes, or a message per cell. `base` keeps what the draft doesn't hold. */
export function fromDraft(
  draft: ProfileDraft,
  base: AutoProfile,
): Result<AutoProfile, DraftErrors> {
  const read = reader();
  const steps = isStepProfile(base);
  const chargeC = read.number('chargeC', draft.chargeC);
  const [soak] = base.phases;
  if (!soak) return err({ name: 'This profile has no steps' });
  const phases = draft.steps.map((step, i) =>
    toPhase(step, i, i === draft.steps.length - 1, steps, read),
  );
  const points = draft.points.map((point, i) => ({
    tS: read.clock(`points.${String(i)}.time`, point.time),
    c: read.number(`points.${String(i)}.c`, point.c),
  }));
  const candidate = {
    ...base,
    name: read.text('name', draft.name),
    batchG: read.number('batchG', draft.batchG),
    chargeC,
    dryEndC: read.number('dryEndC', draft.dryEndC),
    devTimeS: read.clock('devTime', draft.devTime),
    capC: read.number('capC', draft.capC),
    curve: [{ tS: 0, c: chargeC }, ...points],
    phases: [{ ...soak, fanPct: read.number('soakFan', draft.soakFan) }, ...phases],
  };
  if (Object.keys(read.errors).length > 0) return err(read.errors);
  const parsed = AutoProfileSchema.safeParse(candidate);
  if (parsed.success) return ok(parsed.data);
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) errors[cellOf(issue.path)] ??= issue.message;
  return err(errors);
}
