import {
  diffFromUnit,
  diffPlain,
  fromUnit,
  tempPlain,
  type TemperatureUnit,
} from '@roastpilot/shared';
import type { ProfileDraft } from './profile-draft';

/** A typed cell in another unit; text that isn't a number yet is left as typed. */
const convertCell =
  (from: TemperatureUnit, to: TemperatureUnit, kind: 'temp' | 'rate') =>
  (text: string): string => {
    const value = Number(text.trim());
    if (text.trim() === '' || !Number.isFinite(value)) return text;
    return kind === 'temp'
      ? tempPlain(fromUnit(value, from), to)
      : diffPlain(diffFromUnit(value, from), to);
  };

/**
 * A kept draft in the unit now shown, so an edit made in °C reads right after switching to °F
 * (Settings changes the unit at once, while drafts are kept between screens).
 */
export function draftInUnit(draft: ProfileDraft, unit: TemperatureUnit): ProfileDraft {
  if (draft.unit === unit) return draft;
  const temp = convertCell(draft.unit, unit, 'temp');
  const rate = convertCell(draft.unit, unit, 'rate');
  return {
    ...draft,
    unit,
    chargeC: temp(draft.chargeC),
    dryEndC: temp(draft.dryEndC),
    capC: temp(draft.capC),
    steps: draft.steps.map((step) => ({
      ...step,
      endC: temp(step.endC),
      rorMin: rate(step.rorMin),
      rorMax: rate(step.rorMax),
    })),
    points: draft.points.map((point) => ({ ...point, c: temp(point.c) })),
  };
}
