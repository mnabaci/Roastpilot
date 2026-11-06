import type { ConnectTarget, Roaster, SerialPortInfo } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { connectErrorText } from './connect-error';
import { useRun } from '../../features/use-run';
import { useDeps } from '../../app/app-context';
import { activeRoaster } from '../../stores/roasters-store';
import { useConnection, useRoasters } from '../../stores/use-stores';
import { PortPicker } from './PortPicker';
import { roasterRows } from './roaster-rows';

const SIMULATOR: ConnectTarget = { kind: 'simulator' };
const STATE_TEXT = { connecting: 'Connecting…', connected: 'Connected', lost: 'Reconnecting…' };

/**
 * Connect or disconnect one roaster, picking its port first if it has one
 * (docs/spec/ui.md, Roasters screen). Connect makes this roaster the active one.
 */
export function ConnectPanel({ roaster }: { roaster: Roaster }) {
  const { api, stores, logger } = useDeps();
  const run = useRun();
  const active = useRoasters((s) => activeRoaster(s.roasters));
  const connection = useConnection((s) => s.connection);
  const { status } = connection;
  const usedTarget = connection.status === 'disconnected' ? undefined : connection.target;
  const isSimulator = roaster.model === 'simulator';
  const target = isSimulator ? SIMULATOR : roaster.connection;
  // Connect uses the active roaster, so while one is in use it is that one.
  const inUse = usedTarget !== undefined && active?.id === roaster.id;
  const otherInUse = usedTarget !== undefined && !inUse;
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  // With a remembered port, the list stays closed until you choose another.
  const [choosing, setChoosing] = useState(target === null);
  const [showAll, setShowAll] = useState(false);
  const connecting = busy || (inUse && status === 'connecting');
  const idle = status === 'disconnected' && !connecting;

  const refresh = useCallback(() => {
    if (isSimulator) return;
    run('ports.list-failed', async () => {
      setPorts(await api.listPorts());
    });
  }, [api, run, isSimulator]);
  useEffect(refresh, [refresh]);

  /** Connect and a picked port both work on the active roaster, so this one goes first. */
  const makeActive = async (): Promise<boolean> => {
    if (roaster.active) return true;
    const set = await api.setActiveRoaster(roaster.id);
    if (!set.ok) logger.warn('roasters.refused', { ...set.error });
    return set.ok;
  };
  const connect = (to: ConnectTarget) => {
    setError(undefined);
    setBusy(true);
    run('connect.failed', async () => {
      try {
        if (!(await makeActive())) return;
        const result = await api.connect(to);
        if (!result.ok) setError(connectErrorText(result.error));
      } finally {
        setBusy(false);
      }
    });
  };
  const select = (to: ConnectTarget) => {
    setError(undefined);
    run('roasters.choose-failed', async () => {
      if (!(await makeActive())) return;
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

  if (otherInUse) {
    return (
      <p className="text-body text-ink-muted">
        Disconnect {active?.name ?? 'the roaster'} to switch
      </p>
    );
  }

  const shownTarget = inUse ? usedTarget : target;
  const view = roasterRows(ports, {
    inUse: inUse ? usedTarget : undefined,
    saved: target,
    choosing,
    showAll,
  });
  // A Skywalker-type roaster lists ports only; the Simulator is its own record.
  const rows = view.rows.filter((row) => row.target.kind === 'serial');
  const ready = isSimulator || (target !== null && view.savedPresent);
  const hint = error
    ? undefined
    : !isSimulator && idle && !view.anyRoaster && (choosing || !view.savedPresent)
      ? 'No roaster found · plug it in, then Refresh'
      : !isSimulator && idle && target === null
        ? 'Pick a port to connect'
        : undefined;

  return (
    <section aria-label="Connection" className="flex flex-col gap-3">
      {inUse && connection.status !== 'disconnected' ? (
        <p className="text-body text-ink" aria-live="polite">
          {STATE_TEXT[connection.status]}
        </p>
      ) : null}
      {isSimulator ? null : (
        <PortPicker
          rows={rows}
          shown={shownTarget}
          hidden={choosing ? view.hidden : 0}
          canRefresh={!inUse}
          idle={idle}
          canChooseAnother={idle && !choosing && target !== null}
          onSelect={select}
          onRefresh={refresh}
          onShowAll={() => {
            setShowAll(true);
          }}
          onChooseAnother={() => {
            setChoosing(true);
          }}
        />
      )}
      {idle || connecting ? (
        <Button
          variant="primary"
          size="lg"
          disabled={!ready || connecting}
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
      ) : hint ? (
        <p className="text-label text-ink-muted">{hint}</p>
      ) : null}
    </section>
  );
}
