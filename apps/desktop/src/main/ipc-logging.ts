import { serializeError, type Logger } from '@roastpilot/core';
import { RendererLogEntrySchema } from '@roastpilot/shared';
import type { IpcCaller, IpcHandler } from './ipc-deps';

/** Logs every failing handler with its channel, then rethrows so the renderer's call rejects too. */
export function withErrorLogging(
  handlers: Record<string, IpcHandler>,
  logger: Logger,
): Record<string, IpcHandler> {
  return Object.fromEntries(
    Object.entries(handlers).map(([channel, handler]) => [
      channel,
      async (payload: unknown, caller: IpcCaller) => {
        try {
          return await handler(payload, caller);
        } catch (error) {
          logger.error('ipc.handler-failed', { channel, error: serializeError(error) });
          throw error;
        }
      },
    ]),
  );
}

/** A log entry from the renderer: validated, then written under the `renderer` scope. */
export function handleRendererLog(payload: unknown, logger: Logger): void {
  const parsed = RendererLogEntrySchema.safeParse(payload);
  if (!parsed.success) {
    logger.warn('ipc.bad-renderer-log', { issues: parsed.error.issues.map((i) => i.message) });
    return;
  }
  const { level, event, context } = parsed.data;
  logger[level](event, context);
}
