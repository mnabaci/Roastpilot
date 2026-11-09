import type { ConnectTarget, Roaster, SerialPortInfo } from '@roastpilot/shared';
import { useCallback, useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { activeRoaster } from '../../stores/roasters-store';
import { useConnection, useRoasters } from '../../stores/use-stores';
import { connectErrorText } from './connect-error';
import { refusalText } from './roaster-refusal';
import { roasterRows } from './roaster-rows';

const SIMULATOR: ConnectTarget = { kind: 'simulator' };

/**
 * Connecting one roaster (docs/spec/ui.md, Roasters screen): its port, Connect and Disconnect, and
 * what to say about them. The page's header button and its connection card share it. Connect, and
 * picking a port, make this roaster the active one.
 */
export function useConnectControls(roaster: Roaster) {
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
    run(
      'ports.list-failed',
      async () => {
        setPorts(await api.listPorts());
      },
      { failed: "Couldn't list the ports · try Refresh" },
    );
  }, [api, run, isSimulator]);
  useEffect(refresh, [refresh]);

  /** Connect and a picked port both work on the active roaster, so this one goes first. */
  const makeActive = async (): Promise<boolean> => {
    if (roaster.active) return true;
    const set = await api.setActiveRoaster(roaster.id);
    if (set.ok) return true;
    logger.warn('roasters.refused', { ...set.error });
    setError(refusalText(set.error, 'switch roasters'));
    return false;
  };
  const connect = (to: ConnectTarget) => {
    setError(undefined);
    setBusy(true);
    run(
      'connect.failed',
      async () => {
        try {
          if (!(await makeActive())) return;
          const result = await api.connect(to);
          if (!result.ok) setError(connectErrorText(result.error));
        } finally {
          setBusy(false);
        }
      },
      { failed: "Couldn't connect · try again" },
    );
  };
  const select = (to: ConnectTarget) => {
    setError(undefined);
    run(
      'roasters.choose-failed',
      async () => {
        if (!(await makeActive())) return;
        const chosen = await api.chooseConnection(to);
        if (!chosen.ok) {
          logger.warn('roasters.refused', { ...chosen.error });
          setError(refusalText(chosen.error, 'save the port'));
          return;
        }
        stores.roasters.setState({ roasters: await api.listRoasters() });
      },
      { failed: "Couldn't save the port · try again" },
    );
    setChoosing(false);
    setShowAll(false);
  };

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

  return {
    status,
    connection,
    isSimulator,
    target,
    inUse,
    otherInUse,
    otherName: active?.name ?? 'the roaster',
    connecting,
    idle,
    ready,
    rows,
    view,
    shownTarget,
    choosing,
    error,
    hint,
    refresh,
    select,
    connect: () => {
      if (target) connect(target);
    },
    disconnect: () => {
      run('disconnect.failed', () => api.disconnect(), {
        failed: "Couldn't disconnect · try again",
      });
    },
    showAll: () => {
      setShowAll(true);
    },
    chooseAnother: () => {
      setChoosing(true);
    },
  };
}

export type ConnectControls = ReturnType<typeof useConnectControls>;
