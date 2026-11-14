import { serializeError } from '@roastpilot/core';
import type { Tc4Inputs } from '@roastpilot/shared';
import { useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';

/** Often enough to see a probe warm in your hand, rarely enough to leave polling alone. */
export const LIVE_INPUTS_MS = 2000;

const NOTHING: LiveInputs = { inputs: undefined, problem: undefined };

export interface LiveInputs {
  inputs: Tc4Inputs | undefined;
  /** One line when the board didn't answer. */
  problem: string | undefined;
}

/**
 * TC1–TC4 of the connected board, read every 2 s while `enabled` (connected, this roaster, no
 * roast running), so a probe can be picked by its reading (docs/spec/roasters.md, Generic TC4).
 */
export function useLiveInputs(enabled: boolean): LiveInputs {
  const { api, logger } = useDeps();
  const [live, setLive] = useState<LiveInputs>(NOTHING);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const read = () => {
      api
        .readRoasterInputs()
        .then((result) => {
          if (stopped) return;
          if (result.ok) {
            setLive({ inputs: result.value, problem: undefined });
          } else if (result.error.kind !== 'roasting' && result.error.kind !== 'unavailable') {
            logger.warn('roasters.inputs-failed', { ...result.error });
            setLive({ inputs: undefined, problem: "Couldn't read the inputs · check the board" });
          }
        })
        .catch((error: unknown) => {
          logger.error('roasters.inputs-failed', { error: serializeError(error) });
        });
    };
    read();
    const timer = setInterval(read, LIVE_INPUTS_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      // The next time it is enabled starts blank, not on an old reading.
      setLive(NOTHING);
    };
  }, [api, logger, enabled]);
  return enabled ? live : NOTHING;
}
