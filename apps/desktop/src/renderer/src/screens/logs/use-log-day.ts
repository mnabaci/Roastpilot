import { serializeError } from '@roastpilot/core';
import { MAX_LOG_RECORDS, type LogDay, type LogDayRead, type LogRecord } from '@roastpilot/shared';
import { useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';

export type LogDayState =
  { status: 'loading' } | { status: 'failed' } | ({ status: 'loaded' } & LogDayRead);

const key = (r: LogRecord) => JSON.stringify(r);

/** Adds live records, dropping any the file read already had, and keeps the newest MAX_LOG_RECORDS. */
export function mergeLive(read: LogDayRead, live: readonly LogRecord[]): LogDayRead {
  const known = new Set(read.records.slice(-200).map(key));
  const fresh = live.filter((r) => !known.has(key(r)));
  const records = [...read.records, ...fresh];
  const truncated = read.truncated || records.length > MAX_LOG_RECORDS;
  return { ...read, records: records.slice(-MAX_LOG_RECORDS), truncated };
}

/**
 * One day's log. For today it also listens for new entries, from before the file read starts,
 * so nothing written in between is missed.
 */
export function useLogDay(day: LogDay, live: boolean): LogDayState {
  const { api, logger } = useDeps();
  // Tagged with its day, so switching days shows Loading without a reset inside the effect.
  const [state, setState] = useState<{ day: LogDay; value: LogDayState }>();
  useEffect(() => {
    let cancelled = false;
    let buffered: LogRecord[] = [];
    let loaded = false;
    const stop = live
      ? api.onLogEntries((records) => {
          if (!loaded) buffered = [...buffered, ...records];
          else
            setState((s) =>
              s?.day === day && s.value.status === 'loaded'
                ? { day, value: { status: 'loaded', ...mergeLive(s.value, records) } }
                : s,
            );
        })
      : () => undefined;
    api
      .readLogDay(day)
      .then((read) => {
        if (cancelled) return;
        loaded = true;
        setState({ day, value: { status: 'loaded', ...mergeLive(read, buffered) } });
        buffered = [];
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        logger.error('logs.read-failed', { day, error: serializeError(error) });
        setState({ day, value: { status: 'failed' } });
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [api, logger, day, live]);
  return state?.day === day ? state.value : { status: 'loading' };
}
