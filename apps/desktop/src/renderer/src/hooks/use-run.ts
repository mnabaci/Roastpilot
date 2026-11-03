import { serializeError } from '@roastpilot/core';
import { useCallback } from 'react';
import { useDeps } from '../state/app-context';

/** Runs an IPC call from a click: a rejection is logged, never left floating. */
export function useRun(): (event: string, call: () => Promise<unknown>) => void {
  const { logger } = useDeps();
  return useCallback(
    (event, call) => {
      call().catch((error: unknown) => {
        logger.error(event, { error: serializeError(error) });
      });
    },
    [logger],
  );
}
