import type { TasteField, TasteReason, TasteSuggestion } from '@roastpilot/core';
import { formatTemp, type TemperatureUnit } from '@roastpilot/shared';
import { formatClock, formatNumber } from '@roastpilot/ui';

const FIELD_LABELS: Readonly<Record<TasteField, string>> = {
  devTimeS: 'Development',
  capC: 'BT cap',
  chargeC: 'Charge',
};

/** A profile value as the Profiles screen shows it: a time, or a temperature in the unit. */
export function fieldValue(field: TasteField, value: number, unit: TemperatureUnit): string {
  return field === 'devTimeS' ? formatClock(value) : formatTemp(value, unit);
}

/** The one line under the numbers (docs/spec/beans-favourites-ghost.md, The suggestion). */
export function reasonLine(reason: TasteReason, unit: TemperatureUnit): string {
  switch (reason.kind) {
    case 'balanced':
      return 'Sounds right · star it to roast it again';
    case 'mixed':
      return 'Mixed signals · change one thing at a time';
    case 'over-developed':
      return 'Bitter or roasty often means too much development';
    case 'drop-cooler':
      return 'Bitter or roasty · drop a little cooler';
    case 'under-developed':
      return 'Sour, grassy or thin often means under-developed';
    case 'cap-ended':
      return 'The BT cap dropped it before its development time · drop a little hotter';
    case 'already-developed':
      return `Development is already ${formatNumber(reason.share * 100, 0) ?? ''} % · check grind and brew first`;
    case 'after-finding':
      return `Flat or baked often follows a ${reason.finding} · ${formatClock(reason.atS)} · see Roast report`;
    case 'slow-roast':
      return `Flat or baked often means a slow roast · ${formatClock(reason.totalS)} · more heat early`;
    case 'check-beans':
      return 'Not a slow or stalled roast · check bean age and storage first';
    case 'no-first-crack':
      return "No first crack marked · development can't be judged";
    case 'needs-auto':
      return 'Roast on Auto to get a suggestion';
    case 'clashes':
      return `${FIELD_LABELS[reason.field]} can't change alone · a step is in the way · edit it in Profiles`;
    case 'at-limit':
      return `${FIELD_LABELS[reason.field]} ${fieldValue(reason.field, reason.from, unit)} is at its limit`;
  }
}

/** What the suggestion shows: the change in numbers first when there is one, then its line. */
export function suggestionText(
  suggestion: TasteSuggestion,
  unit: TemperatureUnit,
): { change?: string; line: string } {
  const line = reasonLine(suggestion.reason, unit);
  if (suggestion.kind === 'none') return { line };
  const { field, from, to } = suggestion.change;
  return {
    change: `${FIELD_LABELS[field]} ${fieldValue(field, from, unit)} → ${fieldValue(field, to, unit)}`,
    line,
  };
}
