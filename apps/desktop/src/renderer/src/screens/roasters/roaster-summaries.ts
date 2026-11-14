import { tempSymbol, type TemperatureUnit } from '@roastpilot/shared';
import type { RoasterDraft } from './roaster-draft';

/** The roaster page's record cards (docs/spec/ui.md, Roasters screen). */
export type RoasterSection = 'batch' | 'limits' | 'preheat' | 'drum' | 'cooling' | 'tuning';

/** The parts that have a value, joined; a part is left out while its field is empty. */
const join = (parts: readonly (readonly [string, string])[]): string =>
  parts
    .filter(([value]) => value.trim() !== '')
    .map(([value, rest]) => `${value.trim()}${rest}`)
    .join(' · ');

/** "Kp / Ki", or just the one that's set. */
const gains = (kp: string, ki: string): string => [kp, ki].filter((v) => v.trim()).join(' / ');

/**
 * Each record card's line while folded, from the values as shown or typed, numbers before words:
 * "150 g ideal · 100–250 g".
 */
export function sectionSummary(
  section: RoasterSection,
  draft: RoasterDraft,
  unit: TemperatureUnit,
): string {
  const t = ` ${tempSymbol(unit)}`;
  switch (section) {
    case 'batch': {
      const { batchMinG: min, batchMaxG: max } = draft;
      const range = min.trim() && max.trim() ? `${min.trim()}–${max.trim()}` : '';
      return join([
        [draft.batchIdealG, ' g ideal'],
        [range, ' g'],
      ]);
    }
    case 'limits':
      return join([
        [draft.maxTempC, `${t} max`],
        [draft.maxTimeMin, ' min max'],
        [draft.tempOffsetC, `${t} offset`],
      ]);
    case 'preheat':
      return join([
        [draft.hold, ' first'],
        [draft.nextHold, ' next'],
      ]);
    case 'drum':
      return join([[draft.drumSpeedPct, ' %']]);
    case 'cooling':
      return draft.coolerHelpsDrum ? 'Bean cooler helps' : 'Bean cooler off';
    case 'tuning': {
      const parts: [string, string][] = [
        [gains(draft.targetKp, draft.targetKi), ''],
        [gains(draft.curveKp, draft.curveKi), ''],
        [draft.curveLookAheadS, ' s look-ahead'],
        [gains(draft.preheatKp, draft.preheatKi), ''],
      ];
      const labels = ['Steps ', 'Curve ', '', 'Preheat '];
      return parts
        .map(([value, rest], i) => (value.trim() ? `${labels[i] ?? ''}${value.trim()}${rest}` : ''))
        .filter(Boolean)
        .join(' · ');
    }
  }
}
