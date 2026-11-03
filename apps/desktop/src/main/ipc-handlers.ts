import {
  serializeError,
  type Logger,
  type RoasterDriver,
  type RoasterSession,
} from '@roastpilot/core';
import {
  ConnectTargetSchema,
  IPC_CHANNELS,
  RendererLogEntrySchema,
  SetOutputRequestSchema,
  type ConnectTarget,
  type SerialPortInfo,
} from '@roastpilot/shared';

export interface IpcDeps {
  session: Pick<
    RoasterSession,
    'connect' | 'disconnect' | 'setOutput' | 'emergencyStop' | 'acknowledgeSafety'
  >;
  listPorts: () => Promise<SerialPortInfo[]>;
  createDriver: (target: ConnectTarget) => RoasterDriver;
}

export type IpcHandler = (payload: unknown) => Promise<unknown>;

/** Runs `fn` so that anything it throws, a failed validation included, becomes a rejected promise. */
function handler(fn: (payload: unknown) => unknown): IpcHandler {
  return (payload) => Promise.resolve().then(() => fn(payload));
}

/**
 * One handler per invoke channel. Payloads from the renderer are validated before anything runs;
 * a payload that fails its schema is a bug or an attack, so it throws and nothing is sent to the roaster.
 */
export function createIpcHandlers({
  session,
  listPorts,
  createDriver,
}: IpcDeps): Record<string, IpcHandler> {
  return {
    [IPC_CHANNELS.listPorts]: handler(() => listPorts()),
    [IPC_CHANNELS.connect]: handler((payload) =>
      session.connect(createDriver(ConnectTargetSchema.parse(payload))),
    ),
    [IPC_CHANNELS.disconnect]: handler(() => session.disconnect()),
    [IPC_CHANNELS.setOutput]: handler((payload) => {
      const { channel, value } = SetOutputRequestSchema.parse(payload);
      return session.setOutput(channel, value);
    }),
    [IPC_CHANNELS.emergencyStop]: handler(() => {
      session.emergencyStop();
    }),
    [IPC_CHANNELS.acknowledgeSafety]: handler(() => session.acknowledgeSafety()),
  };
}

/** Logs every failing handler with its channel, then rethrows so the renderer's call rejects too. */
export function withErrorLogging(
  handlers: Record<string, IpcHandler>,
  logger: Logger,
): Record<string, IpcHandler> {
  return Object.fromEntries(
    Object.entries(handlers).map(([channel, handler]) => [
      channel,
      async (payload: unknown) => {
        try {
          return await handler(payload);
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
