import type { ConnectTarget, SerialPortInfo } from '@roastpilot/shared';
import { Button, cn } from '@roastpilot/ui';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { connectErrorText } from './connect-error';
import { useRun } from '../../features/use-run';
import { useDeps } from '../../app/app-context';
import { activeRoaster } from '../../stores/roasters-store';
import { useConnection, useRoasters } from '../../stores/use-stores';
import { roasterRows, sameTarget } from './roaster-rows';

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
          // The marked row stays readable while the list is locked; the rest dim.
          'flex min-h-control-sm w-full items-center justify-between gap-3 rounded-md border px-4 text-left text-body',
          !selected && 'disabled:opacity-50',
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
  const { stores, logger } = useDeps();
  // The active roaster holds the port it was last connected on (docs/spec/roasters.md).
  const target = useRoasters((s) => activeRoaster(s.roasters)?.connection ?? null);
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
  // With a remembered roaster, the list stays closed until you choose another.
  const [choosing, setChoosing] = useState(target === null);
  const [showAll, setShowAll] = useState(false);
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
  const { rows, hidden, anyRoaster, savedPresent } = roasterRows(ports, {
    inUse,
    saved: target,
    choosing,
    showAll,
  });
  const select = (to: ConnectTarget) => {
    setError(undefined);
    run('roasters.choose-failed', async () => {
      const chosen = await api.chooseConnection(to);
      if (!chosen.ok) {
        logger.warn('roasters.refused', { ...chosen.error });
        return;
      }
      stores.roasters.setState({ roasters: await api.listRoasters() });
    });
    setChoosing(false);
    setShowAll(false);
  };

  return (
    <section aria-labelledby="connection-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="connection-heading" className="text-heading">
          Connection
        </h2>
        {inUse ? null : (
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw aria-hidden="true" />}
            onClick={refresh}
            disabled={!idle}
          >
            Refresh
          </Button>
        )}
      </div>
      <ul aria-label="Roasters" className="flex flex-col gap-2">
        {rows.map((row) => (
          <TargetRow
            key={row.target.kind === 'serial' ? row.target.path : 'simulator'}
            label={row.label}
            detail={detailFor(row.target, row.detail)}
            selected={sameTarget(marked, row.target)}
            onSelect={() => {
              select(row.target);
            }}
            disabled={!idle}
          />
        ))}
      </ul>
      {hidden > 0 && choosing ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            setShowAll(true);
          }}
        >
          Show all ports ({hidden} more)
        </Button>
      ) : null}
      {idle && !anyRoaster && (choosing || !savedPresent) ? (
        <p className="text-label text-ink-muted">No roaster found · plug it in, then Refresh</p>
      ) : null}
      {idle || connecting ? (
        <Button
          variant="primary"
          size="lg"
          disabled={!target || !savedPresent || connecting}
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
      {idle && !choosing && target ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            setChoosing(true);
          }}
        >
          Choose another
        </Button>
      ) : null}
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
