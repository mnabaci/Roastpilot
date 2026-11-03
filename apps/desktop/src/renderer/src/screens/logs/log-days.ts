import type { LogDay } from '@roastpilot/shared';

/** The local calendar day, as log files are named (main's logDay). */
export function localDay(time: Date): LogDay {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(time.getFullYear())}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`;
}

/** Today first even before its file exists, then the other days newest first. */
export function viewerDays(days: readonly LogDay[], today: LogDay): LogDay[] {
  return [today, ...days.filter((d) => d !== today)];
}

/** Today, Yesterday, then a short date: "Sat 31 Oct". */
export function dayLabel(day: LogDay, today: LogDay): string {
  if (day === today) return 'Today';
  const date = new Date(`${day}T12:00:00`);
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (localDay(date) === localDay(yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
