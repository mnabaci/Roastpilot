import { diffPlain, tempPlain, type TemperatureUnit } from '@roastpilot/shared';
import { unitReader } from '../../lib/unit-reader';
import type { ProfileDraft } from './profile-draft';

/**
 * A typed cell in another unit; text that isn't a number yet is left as typed. A cell still
 * showing one of the profile's own values converts from that exact °C value, so switching back
 * and forth never drifts it (92 °C → 198 °F → 92, not 92.2).
 */
const convertCell =
  (draft: ProfileDraft, to: TemperatureUnit, kind: 'temp' | 'rate') =>
  (text: string): string => {
    if (text.trim() === '' || !Number.isFinite(Number(text.trim()))) return text;
    const read = unitReader(draft.unit, draft.exact);
    return kind === 'temp'
      ? tempPlain(read.temp('cell', text), to)
      : diffPlain(read.rate('cell', text), to);
  };

/**
 * A kept draft in the unit now shown, so an edit made in °C reads right after switching to °F
 * (Settings changes the unit at once, while drafts are kept between screens).
 */
export function draftInUnit(draft: ProfileDraft, unit: TemperatureUnit): ProfileDraft {
  if (draft.unit === unit) return draft;
  const temp = convertCell(draft, unit, 'temp');
  const rate = convertCell(draft, unit, 'rate');
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
