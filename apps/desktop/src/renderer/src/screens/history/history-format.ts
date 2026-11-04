import type { RoastPhase, RoastSummary } from '@roastpilot/shared';
import { formatClock, formatNumber, type RoastListItem } from '@roastpilot/ui';

/** Locale and time zone for dates; the system's when left out (tests pin them). */
export interface DateOptions {
  locale?: string;
  timeZone?: string;
}

/** `Wed 4 Nov · 14:32`, in local time. */
export function roastTitle(startedAt: string, { locale, timeZone }: DateOptions = {}): string {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date);
  return `${day.replace(',', '')} · ${time}`;
}

/** `9:40 · FC 8:00 · 205.5 °C`: total time, first crack, drop temp; missing ones left out. */
export function roastNumbers(roast: RoastSummary): string {
  const temp = formatNumber(roast.dropTemp, 1);
  return [
    roast.dropTimeS === null ? undefined : formatClock(roast.dropTimeS),
    roast.fcTimeS === null ? undefined : `FC ${formatClock(roast.fcTimeS)}`,
    temp === undefined ? undefined : `${temp} °C`,
  ]
    .filter(Boolean)
    .join(' · ');
}

const LIVE_PHASES: readonly RoastPhase[] = ['roasting', 'development', 'cooling'];

/**
 * List rows. A roast that never reached cool end is Unfinished, except the newest one while a
 * roast is running: that one is being saved right now.
 */
export function roastRows(
  roasts: readonly RoastSummary[],
  livePhase: RoastPhase,
  options: DateOptions = {},
): RoastListItem[] {
  const roasting = LIVE_PHASES.includes(livePhase);
  return roasts.map((roast, i) => ({
    id: roast.id,
    title: roastTitle(roast.startedAt, options),
    numbers: roastNumbers(roast),
    badge: roast.endedAt !== null ? undefined : roasting && i === 0 ? 'In progress' : 'Unfinished',
  }));
}

/** The row to select after deleting `id`: the next one down, else the one above. */
export function selectionAfterDelete(
  roasts: readonly RoastSummary[],
  id: number,
): number | undefined {
  const at = roasts.findIndex((r) => r.id === id);
  if (at === -1) return roasts[0]?.id;
  return (roasts[at + 1] ?? roasts[at - 1])?.id;
}
