import type { LogLevel, LogRecord } from '@roastpilot/shared';
import { Badge, Button, cn } from '@roastpilot/ui';
import { useId, useState } from 'react';
import { contextLine } from './log-filter';

const LEVEL: Readonly<
  Record<LogLevel, { label: string; tone: 'heat' | 'air' | 'neutral'; text: string }>
> = {
  error: { label: 'Error', tone: 'heat', text: 'text-critical-text' },
  warn: { label: 'Warning', tone: 'heat', text: 'text-warning' },
  info: { label: 'Info', tone: 'air', text: 'text-ink' },
  debug: { label: 'Debug', tone: 'neutral', text: 'text-ink-muted' },
};

const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/** One entry: time, level, event, scope and a line of context; opens to the full context and Copy. */
export function LogRow({
  record,
  onCopy,
}: {
  record: LogRecord;
  onCopy: (record: LogRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const level = LEVEL[record.level];
  const context = contextLine(record);
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => {
          setOpen(!open);
        }}
        className="flex min-h-control-sm w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="shrink-0 text-label text-ink-muted tabular-nums">
          {clockTime(record.time)}
        </span>
        <Badge tone={level.tone} className="shrink-0">
          {level.label}
        </Badge>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={cn('shrink-0 text-body font-semibold', level.text)}>{record.event}</span>
          <span className="shrink-0 text-label text-ink-muted">{record.scope}</span>
          {context ? (
            <span className="min-w-0 truncate text-label text-ink-muted">{context}</span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div
          id={detailId}
          className="flex items-start justify-between gap-3 bg-surface-raised px-4 py-3"
        >
          <pre className="min-w-0 overflow-x-auto text-label whitespace-pre-wrap text-ink">
            {JSON.stringify(record, null, 2)}
          </pre>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onCopy(record);
            }}
          >
            Copy
          </Button>
        </div>
      ) : null}
    </li>
  );
}
