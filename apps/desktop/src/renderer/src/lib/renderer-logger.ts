import { createLogger, type Logger } from '@roastpilot/core';
import type { RoastpilotApi } from '@roastpilot/shared';

/** A Logger whose entries go to main's log over IPC; main tags them `renderer`. */
export function rendererLogger(api: Pick<RoastpilotApi, 'log'>): Logger {
  return createLogger(
    {
      write: ({ level, scope, event, context }) => {
        api.log({ level, event, context: { ...context, scope } });
      },
    },
    'renderer',
  );
}
