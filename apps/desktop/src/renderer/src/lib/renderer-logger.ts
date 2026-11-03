import { createLogger, type Logger } from '@roastpilot/core';
import type { LogsApi } from '@roastpilot/shared';

/** A Logger whose entries go to main's log over IPC; main tags them `renderer`. */
export function rendererLogger(api: Pick<LogsApi, 'log'>): Logger {
  return createLogger(
    {
      write: ({ level, scope, event, context }) => {
        api.log({ level, event, context: { ...context, scope } });
      },
    },
    'renderer',
  );
}
