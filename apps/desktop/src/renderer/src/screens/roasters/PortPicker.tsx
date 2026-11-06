import type { ConnectTarget } from '@roastpilot/shared';
import { Button, cn } from '@roastpilot/ui';
import { RefreshCw } from 'lucide-react';
import { sameTarget, type RoasterRow } from './roaster-rows';

function PortRow({
  label,
  detail,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          // The marked row stays readable while the list is locked; the rest dim.
          'flex min-h-control-sm w-full items-center justify-between gap-3 rounded-md px-4 text-left text-body',
          !selected && 'disabled:opacity-50',
          selected ? 'bg-heat-tint text-heat' : 'bg-surface-raised hover:bg-surface-hover',
        )}
      >
        <span className="font-semibold">{label}</span>
        {detail ? <span className="text-label text-ink-muted">{detail}</span> : null}
      </button>
    </li>
  );
}

/** A roaster's port: the remembered one, or the likely ones with the rest behind Show all. */
export function PortPicker({
  rows,
  shown,
  hidden,
  canRefresh,
  idle,
  canChooseAnother,
  onSelect,
  onRefresh,
  onShowAll,
  onChooseAnother,
}: {
  rows: readonly RoasterRow[];
  /** The port marked: the one in use, else the remembered one. */
  shown: ConnectTarget | null | undefined;
  /** Ports left out until Show all ports; 0 hides the button. */
  hidden: number;
  canRefresh: boolean;
  /** Nothing connecting or connected: the list can change. */
  idle: boolean;
  canChooseAnother: boolean;
  onSelect: (target: ConnectTarget) => void;
  onRefresh: () => void;
  onShowAll: () => void;
  onChooseAnother: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-body font-semibold">Port</h3>
        {canRefresh ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw aria-hidden="true" />}
            onClick={onRefresh}
            disabled={!idle}
          >
            Refresh
          </Button>
        ) : null}
      </div>
      <ul aria-label="Ports" className="flex flex-col gap-2 empty:hidden">
        {rows.map((row) => (
          <PortRow
            key={row.target.kind === 'serial' ? row.target.path : 'simulator'}
            label={row.label}
            {...(row.detail ? { detail: row.detail } : {})}
            selected={sameTarget(shown, row.target)}
            onSelect={() => {
              onSelect(row.target);
            }}
            disabled={!idle}
          />
        ))}
      </ul>
      {hidden > 0 ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={onShowAll}>
          Show all ports ({hidden} more)
        </Button>
      ) : null}
      {canChooseAnother ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={onChooseAnother}>
          Choose another
        </Button>
      ) : null}
    </>
  );
}
