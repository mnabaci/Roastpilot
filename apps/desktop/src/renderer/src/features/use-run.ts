import { serializeError } from '@roastpilot/core';
import { useCallback } from 'react';
import { useDeps } from '../app/app-context';
import { useToast } from './use-toast';

export interface RunOptions {
  /** Error toast when the call rejects: "Couldn't delete the roast · try again". */
  failed?: string;
}

export type Run = (event: string, call: () => Promise<unknown>, options?: RunOptions) => void;

/**
 * Runs an IPC call from a click: a rejection is logged, never left floating, and with `failed`
 * it also shows an error toast, so the click isn't met with silence.
 */
export function useRun(): Run {
  const { logger } = useDeps();
  const toast = useToast();
  return useCallback(
    (event, call, options) => {
      call().catch((error: unknown) => {
        logger.error(event, { error: serializeError(error) });
        if (options?.failed) toast('error', options.failed);
      });
    },
    [logger, toast],
  );
}
