import { serializeError } from '@roastpilot/core';
import type { Tc4Inputs } from '@roastpilot/shared';
import { useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';

/** Often enough to see a probe warm in your hand, rarely enough to leave polling alone. */
export const LIVE_INPUTS_MS = 2000;

export interface LiveInputs {
  inputs: Tc4Inputs | undefined;
  /** One line when the board didn't answer. */
  problem: string | undefined;
}

const NOTHING: LiveInputs = { inputs: undefined, problem: undefined };

/**
 * TC1–TC4 of the connected board while `enabled` (connected, this roaster, no roast running), so a
 * probe can be picked by its reading (docs/spec/roasters.md, Generic TC4). One read at a time, the
 * next 2 s after the last one ends, so slow replies never stack up behind main's polling; a failure
 * is logged once until a read works again.
 */
export function useLiveInputs(enabled: boolean): LiveInputs {
  const { api, logger } = useDeps();
  const [live, setLive] = useState<LiveInputs>(NOTHING);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let failing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => {
      api
        .readRoasterInputs()
        .then((result) => {
          if (stopped) return;
          if (result.ok) {
            failing = false;
            setLive({ inputs: result.value, problem: undefined });
            return;
          }
          // Not connected yet, or a roast started: nothing to show, nothing wrong.
          if (result.error.kind === 'roasting' || result.error.kind === 'unavailable') return;
          if (!failing) logger.warn('roasters.inputs-failed', { ...result.error });
          failing = true;
          setLive({ inputs: undefined, problem: "Couldn't read the inputs · check the board" });
        })
        .catch((error: unknown) => {
          if (!failing) logger.error('roasters.inputs-failed', { error: serializeError(error) });
          failing = true;
        })
        .finally(() => {
          if (!stopped) timer = setTimeout(read, LIVE_INPUTS_MS);
        });
    };
    read();
    return () => {
      stopped = true;
      clearTimeout(timer);
      // The next time it is enabled starts blank, not on an old reading.
      setLive(NOTHING);
    };
  }, [api, logger, enabled]);
  return enabled ? live : NOTHING;
}
