import {
  formatTemp,
  type Bean,
  type RoastPhase,
  type RoastSummary,
  type TemperatureUnit,
} from '@roastpilot/shared';
import { formatClock, type RoastListItem } from '@roastpilot/ui';

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
export function roastNumbers(roast: RoastSummary, unit: TemperatureUnit): string {
  const temp = roast.dropTemp === null ? undefined : formatTemp(roast.dropTemp, unit, 1);
  return [
    roast.dropTimeS === null ? undefined : formatClock(roast.dropTimeS),
    roast.fcTimeS === null ? undefined : `FC ${formatClock(roast.fcTimeS)}`,
    temp,
  ]
    .filter(Boolean)
    .join(' · ');
}

const LIVE_PHASES: readonly RoastPhase[] = ['roasting', 'development', 'cooling'];

/** The roast being saved right now: the newest, unended one while a roast runs. */
export function inProgressId(
  roasts: readonly RoastSummary[],
  livePhase: RoastPhase,
): number | undefined {
  const newest = roasts[0];
  return newest?.endedAt === null && LIVE_PHASES.includes(livePhase) ? newest.id : undefined;
}

/** `Yirgacheffe · Light · Steps · 4/5`: bean, profile and rating. */
export function roastDetailLine(
  roast: RoastSummary,
  beans: readonly Pick<Bean, 'id' | 'name'>[],
): string {
  return [
    beans.find((b) => b.id === roast.beanId)?.name ?? 'No bean',
    roast.profileName ?? 'Manual',
    roast.rating === null ? undefined : `${String(roast.rating)}/5`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** List rows. A roast that never reached its end is Unfinished, unless it is in progress. */
export function roastRows(
  roasts: readonly RoastSummary[],
  livePhase: RoastPhase,
  unit: TemperatureUnit,
  options: DateOptions = {},
  beans: readonly Pick<Bean, 'id' | 'name'>[] = [],
): RoastListItem[] {
  const live = inProgressId(roasts, livePhase);
  return roasts.map((roast) => ({
    id: roast.id,
    title: roastTitle(roast.startedAt, options),
    numbers: roastNumbers(roast, unit),
    detail: roastDetailLine(roast, beans),
    favourite: roast.isFavourite,
    badge: roast.endedAt !== null ? undefined : roast.id === live ? 'In progress' : 'Unfinished',
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
