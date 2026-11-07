import type { LogLevel, LogRecord } from '@roastpilot/shared';
import { Badge, FilterSelect, Menu, TextField } from '@roastpilot/ui';
import { FolderOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { ChipGroup } from './ChipGroup';
import { dayLabel, localDay, viewerDays } from './log-days';
import { countLevels, DEFAULT_LEVELS, filterLogs, scopesOf } from './log-filter';
import { LogEntries } from './LogEntries';
import { useLogDay } from './use-log-day';
import { useLogDays } from './use-log-days';

const LEVELS: readonly { id: LogLevel; label: string }[] = [
  { id: 'error', label: 'Error' },
  { id: 'warn', label: 'Warning' },
  { id: 'info', label: 'Info' },
  { id: 'debug', label: 'Debug' },
];

const toggle = <T,>(set: ReadonlySet<T>, id: T): Set<T> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** The log viewer (docs/spec/errors-and-logging.md, Viewer). */
export function LogsScreen() {
  const { api } = useDeps();
  const run = useRun();
  const today = localDay(new Date());
  const days = viewerDays(useLogDays(), today);
  const [day, setDay] = useState(today);
  const [levels, setLevels] = useState<ReadonlySet<LogLevel>>(DEFAULT_LEVELS);
  const [scopes, setScopes] = useState<ReadonlySet<string>>(new Set());
  const [text, setText] = useState('');
  const log = useLogDay(day, day === today);

  const records = useMemo(() => (log.status === 'loaded' ? log.records : []), [log]);
  const shown = useMemo(
    () => filterLogs(records, { levels, scopes, text }),
    [records, levels, scopes, text],
  );
  const counts = countLevels(records);

  const copy = (record: LogRecord) => {
    run('logs.copy-failed', () => navigator.clipboard.writeText(JSON.stringify(record, null, 2)));
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-title">Logs</h1>
        {day === today ? <Badge tone="air">Live</Badge> : null}
        <Menu
          label="More for Logs"
          className="ml-auto"
          items={[
            {
              label: 'Open log folder',
              icon: <FolderOpen aria-hidden="true" />,
              onSelect: () => {
                run('logs.open-folder-failed', () => api.openLogFolder());
              },
            },
          ]}
        />
      </div>
      <FilterSelect
        label="Day"
        className="self-start"
        value={day}
        options={days.map((d) => ({ value: d, label: dayLabel(d, today) }))}
        onChange={(d) => {
          setDay(d);
          setScopes(new Set());
        }}
      />
      <div className="flex flex-wrap items-end gap-6">
        <TextField
          label="Search"
          type="search"
          placeholder="Event, scope or context"
          value={text}
          onChange={setText}
          className="w-80"
        />
        <ChipGroup
          label="Levels"
          chips={LEVELS.map(({ id, label }) => ({ id, label: `${label} ${String(counts[id])}` }))}
          isOn={(id) => levels.has(id)}
          onToggle={(id) => {
            setLevels(toggle(levels, id));
          }}
        />
      </div>
      <ChipGroup
        label="Scopes"
        chips={scopesOf(records).map((s) => ({ id: s, label: s }))}
        isOn={(s) => scopes.has(s)}
        onToggle={(s) => {
          setScopes(toggle(scopes, s));
        }}
      />
      <LogEntries log={log} shown={shown} onCopy={copy} />
    </main>
  );
}
