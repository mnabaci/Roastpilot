import type { ConnectTarget, SerialPortInfo } from '@roastpilot/shared';
import { Button, cn } from '@roastpilot/ui';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { connectErrorText } from './connect-error';
import { useRun } from '../../features/use-run';
import { useDeps } from '../../app/app-context';
import { useConnection, useSettings } from '../../stores/use-stores';
import { useSaveSettings } from './use-save-settings';

const SIMULATOR: ConnectTarget = { kind: 'simulator' };

const sameTarget = (a: ConnectTarget | null, b: ConnectTarget) =>
  a?.kind === b.kind && (a.kind === 'simulator' || (b.kind === 'serial' && a.path === b.path));

function TargetRow({
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
          'flex min-h-control-sm w-full items-center justify-between gap-3 rounded-md border px-4 text-left text-body disabled:opacity-50',
          selected ? 'border-heat bg-heat-tint' : 'border-border bg-surface hover:bg-surface-hover',
        )}
      >
        <span className="font-semibold">{label}</span>
        {detail ? <span className="text-label text-ink-muted">{detail}</span> : null}
      </button>
    </li>
  );
}

/** Pick a serial port or the Simulator, then Connect (docs/spec/ui.md, Settings). */
export function ConnectionSection() {
  const { api } = useDeps();
  const run = useRun();
  const save = useSaveSettings();
  const target = useSettings((s) => s.settings.connection);
  const connection = useConnection((s) => s.connection);
  const { status } = connection;
  // While a roaster is in use, its row is the one marked, whatever was picked before.
  const inUse = connection.status === 'disconnected' ? undefined : connection.target;
  const marked = inUse ?? target;
  const STATE_DETAIL = { connecting: 'Connecting…', connected: 'Connected', lost: 'Reconnecting…' };
  const detailFor = (row: ConnectTarget, fallback?: string) =>
    connection.status !== 'disconnected' && sameTarget(inUse ?? null, row)
      ? STATE_DETAIL[connection.status]
      : fallback;
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const connecting = busy || status === 'connecting';
  // The roaster list and Refresh wait while connecting or connected.
  const idle = status === 'disconnected' && !connecting;

  const refresh = useCallback(() => {
    run('ports.list-failed', async () => {
      setPorts(await api.listPorts());
    });
  }, [api, run]);
  useEffect(refresh, [refresh]);

  const connect = (to: ConnectTarget) => {
    setError(undefined);
    setBusy(true);
    run('connect.failed', async () => {
      try {
        const result = await api.connect(to);
        if (!result.ok) setError(connectErrorText(result.error));
      } finally {
        setBusy(false);
      }
    });
  };
  const select = (to: ConnectTarget) => {
    setError(undefined);
    save({ connection: to });
  };

  return (
    <section aria-labelledby="connection-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="connection-heading" className="text-heading">
          Roaster
        </h2>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw aria-hidden="true" />}
          onClick={refresh}
          disabled={!idle}
        >
          Refresh
        </Button>
      </div>
      <ul aria-label="Roasters" className="flex flex-col gap-2">
        {ports.map((port) => (
          <TargetRow
            key={port.path}
            label={port.path}
            detail={detailFor({ kind: 'serial', path: port.path }, port.manufacturer)}
            selected={sameTarget(marked, { kind: 'serial', path: port.path })}
            onSelect={() => {
              select({ kind: 'serial', path: port.path });
            }}
            disabled={!idle}
          />
        ))}
        <TargetRow
          label="Simulator"
          detail={detailFor(SIMULATOR, 'Practice without a roaster')}
          selected={sameTarget(marked, SIMULATOR)}
          onSelect={() => {
            select(SIMULATOR);
          }}
          disabled={!idle}
        />
      </ul>
      {ports.length === 0 ? (
        <p className="text-label text-ink-muted">
          No serial ports found · plug in the roaster, then Refresh
        </p>
      ) : null}
      {idle || connecting ? (
        <Button
          variant="primary"
          size="lg"
          disabled={!target || connecting}
          aria-busy={connecting}
          icon={
            connecting ? (
              <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
            ) : undefined
          }
          onClick={() => {
            if (target) connect(target);
          }}
        >
          {connecting ? 'Connecting…' : 'Connect'}
        </Button>
      ) : (
        <Button
          size="lg"
          onClick={() => {
            run('disconnect.failed', () => api.disconnect());
          }}
        >
          Disconnect
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-body text-critical-text">
          {error}
        </p>
      ) : !target && idle ? (
        <p className="text-label text-ink-muted">Pick a roaster to connect</p>
      ) : null}
    </section>
  );
}
