import { MAX_LOG_RECORDS, type LogRecord } from '@roastpilot/shared';
import { LogRow } from './LogRow';
import type { LogDayState } from './use-log-day';

/** What the file read left out, in one line; nothing when it read every line. */
function readNotice(log: LogDayState): string | undefined {
  if (log.status !== 'loaded') return undefined;
  const parts = [
    log.truncated ? `Showing the newest ${MAX_LOG_RECORDS.toLocaleString('en-GB')} entries` : '',
    log.unreadable > 0 ? `${String(log.unreadable)} lines unreadable` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** The day's entries that pass the filter, or why there are none. */
export function LogEntries({
  log,
  shown,
  onCopy,
}: {
  log: LogDayState;
  /** The entries that pass the filter, newest first. */
  shown: readonly LogRecord[];
  onCopy: (record: LogRecord) => void;
}) {
  const notice = readNotice(log);
  return (
    <>
      {notice ? <p className="text-label text-ink-muted">{notice}</p> : null}
      {log.status === 'failed' ? (
        <p role="alert" className="text-body text-critical-text">
          Couldn't read this day's log · Open log folder to see the file
        </p>
      ) : log.status === 'loading' ? (
        <p className="text-label text-ink-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-label text-ink-muted">
          {log.records.length === 0
            ? 'Nothing logged this day'
            : 'No entries match · try more levels'}
        </p>
      ) : (
        <ul aria-label="Log entries" className="min-h-0 overflow-y-auto rounded-xl bg-surface">
          {shown.map((record, i) => (
            // Counted from the oldest, so a live entry arriving on top keeps the others' keys (and open rows).
            <LogRow key={shown.length - i} record={record} onCopy={onCopy} />
          ))}
        </ul>
      )}
    </>
  );
}
