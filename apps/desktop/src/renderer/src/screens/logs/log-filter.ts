import type { LogLevel, LogRecord } from '@roastpilot/shared';

export interface LogFilter {
  levels: ReadonlySet<LogLevel>;
  /** Empty means every scope. */
  scopes: ReadonlySet<string>;
  text: string;
}

/** The viewer opens on problems (docs/spec/errors-and-logging.md, Viewer). */
export const DEFAULT_LEVELS: ReadonlySet<LogLevel> = new Set(['error', 'warn']);

/** One line of context for the list, and what the search looks through. */
export const contextLine = (record: LogRecord): string =>
  record.context === undefined ? '' : JSON.stringify(record.context);

/** The records that pass the filter, newest first. */
export function filterLogs(records: readonly LogRecord[], filter: LogFilter): LogRecord[] {
  const text = filter.text.trim().toLowerCase();
  return records
    .filter(
      (r) =>
        filter.levels.has(r.level) &&
        (filter.scopes.size === 0 || filter.scopes.has(r.scope)) &&
        (text === '' || `${r.event} ${r.scope} ${contextLine(r)}`.toLowerCase().includes(text)),
    )
    .reverse();
}

/** Every scope in the records, sorted, for the scope chips. */
export function scopesOf(records: readonly LogRecord[]): string[] {
  return [...new Set(records.map((r) => r.scope))].sort();
}

/** How many records of each level, for the level chips. */
export function countLevels(records: readonly LogRecord[]): Record<LogLevel, number> {
  const counts: Record<LogLevel, number> = { error: 0, warn: 0, info: 0, debug: 0 };
  for (const r of records) counts[r.level]++;
  return counts;
}
