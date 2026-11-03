import { serializeError } from '@roastpilot/core';
import type { Reading } from '@roastpilot/shared';
import { useEffect, useMemo, useState } from 'react';
import { throttle } from '../lib/throttle';
import { useAppState, useDeps } from '../state/app-context';

/** Slider commands go out at most this often while dragging. */
export const OUTPUT_THROTTLE_MS = 150;
/** Two polls: by then the roaster has reported your value, or something else won. */
export const PENDING_MS = 2_000;

interface Pending {
  value: number;
  /** What the roaster reported when you set it, and when (main's clock). */
  before: number | undefined;
  sinceMs: number;
}

/** Your value shows until a later reading reports a change, or PENDING_MS has passed. */
function pendingShown(pending: Pending, channel: string, readings: readonly Reading[]): boolean {
  const latest = readings.at(-1);
  if (latest && latest.atMs - pending.sinceMs >= PENDING_MS) return false;
  for (let i = readings.length - 1; i >= 0; i--) {
    const reading = readings[i];
    if (!reading || reading.atMs <= pending.sinceMs) break;
    if (reading.values[channel] !== pending.before) return false;
  }
  return true;
}

/**
 * One roaster output: the value to show and a setter. While you drag, the slider shows your
 * value; once the roaster reports a change (or refuses it), the slider follows the readings again.
 */
export function useOutput(channel: string): { value: number; set: (value: number) => void } {
  const { api, logger, store } = useDeps();
  const [pending, setPending] = useState<Pending>();
  const value = useAppState((s) => {
    const reported = s.readings.at(-1)?.values[channel];
    return (pending && pendingShown(pending, channel, s.readings) ? pending.value : reported) ?? 0;
  });

  const sender = useMemo(
    () =>
      throttle((next: number) => {
        api
          .setOutput({ channel, value: next })
          .then((result) => {
            if (result.ok) return;
            logger.warn('output.refused', { channel, value: next, error: result.error });
            setPending(undefined);
          })
          .catch((error: unknown) => {
            logger.error('output.send-failed', {
              channel,
              value: next,
              error: serializeError(error),
            });
            setPending(undefined);
          });
      }, OUTPUT_THROTTLE_MS),
    [api, logger, channel],
  );
  useEffect(
    () => () => {
      sender.cancel();
    },
    [sender],
  );

  return {
    value,
    set: (next) => {
      const latest = store.getState().readings.at(-1);
      setPending({ value: next, before: latest?.values[channel], sinceMs: latest?.atMs ?? 0 });
      sender.push(next);
    },
  };
}
