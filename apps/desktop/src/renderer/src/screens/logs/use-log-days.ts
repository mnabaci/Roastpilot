import { serializeError } from '@roastpilot/core';
import type { LogDay } from '@roastpilot/shared';
import { useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';

/** Days that have a log file, newest first; empty until loaded or if listing fails (logged). */
export function useLogDays(): LogDay[] {
  const { api, logger } = useDeps();
  const [days, setDays] = useState<LogDay[]>([]);
  useEffect(() => {
    let cancelled = false;
    api
      .listLogDays()
      .then((list) => {
        if (!cancelled) setDays(list);
      })
      .catch((error: unknown) => {
        logger.error('logs.list-failed', { error: serializeError(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [api, logger]);
  return days;
}
