import {
  serializeError,
  type AutoPilot,
  type Logger,
  type ManualRoast,
  type RoasterDriver,
  type RoasterSession,
} from '@roastpilot/core';
import {
  AutoProfileSchema,
  ConnectTargetSchema,
  IPC_CHANNELS,
  LogDaySchema,
  ProfileIdSchema,
  RendererLogEntrySchema,
  RoastActionSchema,
  RoastIdSchema,
  SetOutputRequestSchema,
  SettingsSchema,
  type ConnectTarget,
  type LogDay,
  type LogDayRead,
  type SerialPortInfo,
  type Snapshot,
} from '@roastpilot/shared';
import type { HistoryService } from './history/history-service';
import type { ProfileService } from './profiles/profile-service';
import type { SettingsService } from './settings/settings-service';

export interface IpcDeps {
  session: Pick<
    RoasterSession,
    'connect' | 'disconnect' | 'setOutput' | 'emergencyStop' | 'acknowledgeSafety'
  >;
  roast: Pick<ManualRoast, 'act' | 'outputRequested'>;
  settings: Pick<SettingsService, 'get' | 'set'>;
  history: Pick<HistoryService, 'list' | 'get' | 'delete'>;
  pilot: Pick<AutoPilot, 'chargeSoon' | 'outputRequested' | 'resume'>;
  profiles: Pick<ProfileService, 'list' | 'duplicate' | 'save' | 'delete'>;
  /** The clock's now, for Charge soon. */
  nowMs: () => number;
  snapshot: () => Snapshot;
  listPorts: () => Promise<SerialPortInfo[]>;
  createDriver: (target: ConnectTarget) => RoasterDriver;
  logs: {
    listDays: () => Promise<LogDay[]>;
    readDay: (day: LogDay) => Promise<LogDayRead>;
    openFolder: () => Promise<void>;
  };
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
  roast,
  settings,
  history,
  pilot,
  profiles,
  nowMs,
  snapshot,
  listPorts,
  createDriver,
  logs,
}: IpcDeps): Record<string, IpcHandler> {
  return {
    [IPC_CHANNELS.listPorts]: handler(() => listPorts()),
    [IPC_CHANNELS.connect]: handler((payload) => {
      const target = ConnectTargetSchema.parse(payload);
      return session.connect(createDriver(target), target);
    }),
    [IPC_CHANNELS.disconnect]: handler(() => session.disconnect()),
    [IPC_CHANNELS.setOutput]: handler((payload) => {
      const { channel, value } = SetOutputRequestSchema.parse(payload);
      roast.outputRequested(channel, value);
      pilot.outputRequested(channel, value);
      return session.setOutput(channel, value);
    }),
    [IPC_CHANNELS.emergencyStop]: handler(() => {
      session.emergencyStop();
    }),
    [IPC_CHANNELS.acknowledgeSafety]: handler(() => session.acknowledgeSafety()),
    [IPC_CHANNELS.getSnapshot]: handler(() => snapshot()),
    [IPC_CHANNELS.roastAction]: handler((payload) => roast.act(RoastActionSchema.parse(payload))),
    [IPC_CHANNELS.getSettings]: handler(() => settings.get()),
    [IPC_CHANNELS.setSettings]: handler((payload) => settings.set(SettingsSchema.parse(payload))),
    [IPC_CHANNELS.listLogDays]: handler(() => logs.listDays()),
    [IPC_CHANNELS.readLogDay]: handler((payload) => logs.readDay(LogDaySchema.parse(payload))),
    [IPC_CHANNELS.openLogFolder]: handler(() => logs.openFolder()),
    [IPC_CHANNELS.listRoasts]: handler(() => history.list()),
    [IPC_CHANNELS.getRoast]: handler((payload) => history.get(RoastIdSchema.parse(payload))),
    [IPC_CHANNELS.deleteRoast]: handler((payload) => history.delete(RoastIdSchema.parse(payload))),
    [IPC_CHANNELS.autoChargeSoon]: handler(() => pilot.chargeSoon(nowMs())),
    [IPC_CHANNELS.autoResume]: handler(() => pilot.resume()),
    [IPC_CHANNELS.listProfiles]: handler(() => profiles.list()),
    [IPC_CHANNELS.duplicateProfile]: handler((payload) =>
      profiles.duplicate(ProfileIdSchema.parse(payload)),
    ),
    [IPC_CHANNELS.saveProfile]: handler((payload) =>
      profiles.save(AutoProfileSchema.parse(payload)),
    ),
    [IPC_CHANNELS.deleteProfile]: handler((payload) =>
      profiles.delete(ProfileIdSchema.parse(payload)),
    ),
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
