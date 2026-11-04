import { serializeError } from '@roastpilot/core';
import type { RoastSummary } from '@roastpilot/shared';
import { useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';

/** Saved roasts, newest first; undefined until the first load. Reloads when main saves or deletes one. */
export function useRoastList(): RoastSummary[] | undefined {
  const { api, logger } = useDeps();
  const [roasts, setRoasts] = useState<RoastSummary[]>();
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .listRoasts()
        .then((list) => {
          if (!cancelled) setRoasts(list);
        })
        .catch((error: unknown) => {
          logger.error('history.list-failed', { error: serializeError(error) });
          if (!cancelled) setRoasts((current) => current ?? []);
        });
    };
    const stop = api.onRoastsChanged(load);
    load();
    return () => {
      cancelled = true;
      stop();
    };
  }, [api, logger]);
  return roasts;
}
