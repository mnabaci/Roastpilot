import { serializeError } from '@roastpilot/core';
import type { RoastDetail, RoastId } from '@roastpilot/shared';
import { useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';

export type SavedRoastState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; detail: RoastDetail };

/** One saved roast with its samples and events; reloads when main reports a change to it. */
export function useSavedRoast(id: RoastId | undefined): SavedRoastState {
  const { api, logger } = useDeps();
  // Tagged with its id, so picking another roast shows Loading without a reset inside the effect.
  const [state, setState] = useState<{ id: RoastId; value: SavedRoastState }>();
  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    const load = () => {
      api
        .getRoast(id)
        .then((read) => {
          if (cancelled) return;
          setState({
            id,
            value: read.ok ? { status: 'loaded', detail: read.value } : { status: 'failed' },
          });
        })
        .catch((error: unknown) => {
          logger.error('history.get-failed', { id, error: serializeError(error) });
          if (!cancelled) setState({ id, value: { status: 'failed' } });
        });
    };
    const stop = api.onRoastsChanged((change) => {
      if (change.id === id) load();
    });
    load();
    return () => {
      cancelled = true;
      stop();
    };
  }, [api, logger, id]);
  if (id === undefined) return { status: 'none' };
  return state?.id === id ? state.value : { status: 'loading' };
}
