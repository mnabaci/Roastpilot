import { RoasterSchema, type Result, type Roaster } from '@roastpilot/shared';
import { formatClock } from '@roastpilot/ui';

/** The roaster editor's cells, as typed. */
export interface RoasterDraft {
  name: string;
  batchMinG: string;
  batchIdealG: string;
  batchMaxG: string;
  maxTempC: string;
  maxTimeMin: string;
  tempOffsetC: string;
  hold: string;
  targetKp: string;
  targetKi: string;
  targetLimitPct: string;
  followKp: string;
  followKi: string;
  preheatKp: string;
  preheatKi: string;
  /** The usual speed of a drum that has one. */
  drumSpeedPct: string;
  /** On / off, not typed: the Cooling switch. */
  coolerHelpsDrum: boolean;
}

/** The cells typed as text. */
export type TextCell = {
  [K in keyof RoasterDraft]: RoasterDraft[K] extends string ? K : never;
}[keyof RoasterDraft];

export type RoasterDraftErrors = Readonly<Partial<Record<keyof RoasterDraft, string>>>;

export function toRoasterDraft(roaster: Roaster): RoasterDraft {
  const { tuning } = roaster;
  return {
    name: roaster.name,
    batchMinG: String(roaster.batchMinG),
    batchIdealG: String(roaster.batchIdealG),
    batchMaxG: String(roaster.batchMaxG),
    maxTempC: String(roaster.maxTempC),
    maxTimeMin: String(roaster.maxTimeS / 60),
    tempOffsetC: String(roaster.tempOffsetC),
    hold: formatClock(tuning.holdS),
    targetKp: String(tuning.target.kp),
    targetKi: String(tuning.target.ki),
    targetLimitPct: String(tuning.targetLimitPct),
    followKp: String(tuning.follow.kp),
    followKi: String(tuning.follow.ki),
    preheatKp: String(tuning.preheat.kp),
    preheatKi: String(tuning.preheat.ki),
    drumSpeedPct: String(roaster.drumSpeedPct),
    coolerHelpsDrum: roaster.coolerHelpsDrum,
  };
}

/** Which cell a schema issue belongs to. */
const CELL_OF: Readonly<Record<string, keyof RoasterDraft>> = {
  name: 'name',
  batchMinG: 'batchMinG',
  batchIdealG: 'batchIdealG',
  batchMaxG: 'batchMaxG',
  maxTempC: 'maxTempC',
  maxTimeS: 'maxTimeMin',
  tempOffsetC: 'tempOffsetC',
  'tuning.holdS': 'hold',
  'tuning.target.kp': 'targetKp',
  'tuning.target.ki': 'targetKi',
  'tuning.targetLimitPct': 'targetLimitPct',
  'tuning.follow.kp': 'followKp',
  'tuning.follow.ki': 'followKi',
  'tuning.preheat.kp': 'preheatKp',
  'tuning.preheat.ki': 'preheatKi',
  drumSpeedPct: 'drumSpeedPct',
};

/** The record a draft makes, or a message per cell. `base` keeps what the draft doesn't hold. */
export function fromRoasterDraft(
  draft: RoasterDraft,
  base: Roaster,
): Result<Roaster, RoasterDraftErrors> {
  const errors: Partial<Record<keyof RoasterDraft, string>> = {};
  const number = (cell: TextCell): number => {
    const text = draft[cell].trim();
    const value = Number(text);
    if (text === '' || !Number.isFinite(value)) errors[cell] = 'Enter a number';
    return value;
  };
  const clock = /^(\d+):([0-5]\d)$/.exec(draft.hold.trim());
  if (!clock) errors.hold = 'Enter a time like 2:30';
  const { tuning } = base;
  const candidate = {
    ...base,
    name: draft.name,
    batchMinG: number('batchMinG'),
    batchIdealG: number('batchIdealG'),
    batchMaxG: number('batchMaxG'),
    maxTempC: number('maxTempC'),
    maxTimeS: number('maxTimeMin') * 60,
    tempOffsetC: number('tempOffsetC'),
    coolerHelpsDrum: draft.coolerHelpsDrum,
    drumSpeedPct: number('drumSpeedPct'),
    tuning: {
      ...tuning,
      holdS: clock ? Number(clock[1]) * 60 + Number(clock[2]) : tuning.holdS,
      target: { ...tuning.target, kp: number('targetKp'), ki: number('targetKi') },
      targetLimitPct: number('targetLimitPct'),
      follow: { ...tuning.follow, kp: number('followKp'), ki: number('followKi') },
      preheat: { ...tuning.preheat, kp: number('preheatKp'), ki: number('preheatKi') },
    },
  };
  if (Object.keys(errors).length > 0) return { ok: false, error: errors };
  const parsed = RoasterSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, value: parsed.data };
  for (const issue of parsed.error.issues) {
    const cell = CELL_OF[issue.path.join('.')];
    if (cell) errors[cell] ??= issue.message;
  }
  return { ok: false, error: errors };
}
