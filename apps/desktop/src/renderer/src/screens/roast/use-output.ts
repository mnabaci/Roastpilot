import { serializeError } from '@roastpilot/core';
import type { Reading } from '@roastpilot/shared';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useToast } from '../../features/use-toast';
import { useRoast } from '../../stores/use-stores';

const OUTPUT_NAME: Readonly<Record<string, string>> = { cooling: 'bean cooler' };

/** "Couldn't set the heater · try again". */
const outputFailed = (channel: string) =>
  `Couldn't set the ${OUTPUT_NAME[channel] ?? channel} · try again`;

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
  const { api, logger, stores } = useDeps();
  const toast = useToast();
  const [pending, setPending] = useState<Pending>();
  const value = useRoast((s) => {
    const reported = s.readings.at(-1)?.values[channel];
    return (pending && pendingShown(pending, channel, s.readings) ? pending.value : reported) ?? 0;
  });

  /** One command per value you chose: the slider sends only when you let go. */
  const send = (next: number) => {
    api
      .setOutput({ channel, value: next })
      .then((result) => {
        if (result.ok) return;
        logger.warn('output.refused', { channel, value: next, error: result.error });
        setPending(undefined);
        // The safety lock and a lost roaster have their own banners.
        if (result.error.kind !== 'safety-locked' && result.error.kind !== 'disconnected')
          toast('error', outputFailed(channel));
      })
      .catch((error: unknown) => {
        logger.error('output.send-failed', { channel, value: next, error: serializeError(error) });
        setPending(undefined);
        toast('error', outputFailed(channel));
      });
  };

  return {
    value,
    set: (next) => {
      const latest = stores.roast.getState().readings.at(-1);
      setPending({ value: next, before: latest?.values[channel], sinceMs: latest?.atMs ?? 0 });
      send(next);
    },
  };
}
