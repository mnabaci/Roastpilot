import {
  CoachRequestSchema,
  ConnectTargetSchema,
  ExportLibraryRequestSchema,
  ExportRoastsRequestSchema,
  ImportLibraryRequestSchema,
  LogDaySchema,
  MakeProfileRequestSchema,
  PreheatHoldRequestSchema,
  ReleasePageSchema,
  RoastActionSchema,
  RoastIdSchema,
  RoastResultSchema,
  RoastSetupSchema,
  SetOutputRequestSchema,
  SetRoastBeanRequestSchema,
  SettingsSchema,
  IPC_CHANNELS,
} from '@roastpilot/shared';
import type { IpcDeps, IpcHandlers } from './ipc-deps';
import { handler } from './ipc-handler';
import { beanIpcHandlers, profileIpcHandlers, roasterIpcHandlers } from './library-ipc-handlers';

export type { AnyIpcHandler, IpcCaller, IpcDeps, IpcHandler, IpcHandlers } from './ipc-deps';
export { handleRendererLog, withErrorLogging } from './ipc-logging';

/**
 * One handler per invoke channel. Payloads from the renderer are validated before anything runs;
 * a payload that fails its schema is a bug or an attack, so it throws and nothing is sent to the roaster.
 */
export function createIpcHandlers({
  session,
  roast,
  setOutputByHand,
  coach,
  settings,
  history,
  roastFiles,
  libraryFiles,
  pilot,
  profiles,
  roasters,
  beans,
  makeProfile,
  makeBeanProfile,
  openBeanLink,
  nowMs,
  snapshot,
  listPorts,
  createDriver,
  tc4,
  updates,
  logs,
}: IpcDeps): IpcHandlers {
  return {
    [IPC_CHANNELS.listPorts]: handler(() => listPorts()),
    [IPC_CHANNELS.connect]: handler((payload) => {
      const target = ConnectTargetSchema.parse(payload);
      const driver = createDriver(target);
      return driver.ok ? session.connect(driver.value, target) : driver;
    }),
    [IPC_CHANNELS.disconnect]: handler(() => session.disconnect()),
    [IPC_CHANNELS.setOutput]: handler((payload) => {
      const { channel, value } = SetOutputRequestSchema.parse(payload);
      return setOutputByHand(channel, value);
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
    [IPC_CHANNELS.exportRoasts]: handler((payload, { window }) =>
      roastFiles.exportRoasts(ExportRoastsRequestSchema.parse(payload), window),
    ),
    [IPC_CHANNELS.importRoasts]: handler((_payload, { window }) => roastFiles.importRoasts(window)),
    [IPC_CHANNELS.setRoastBean]: handler((payload) => {
      const { id, beanId } = SetRoastBeanRequestSchema.parse(payload);
      return history.setBean(id, beanId);
    }),
    [IPC_CHANNELS.importArtisan]: handler((_payload, { window }) =>
      roastFiles.importArtisan(window),
    ),
    [IPC_CHANNELS.exportLibrary]: handler((payload, { window }) =>
      libraryFiles.exportLibrary(ExportLibraryRequestSchema.parse(payload), window),
    ),
    [IPC_CHANNELS.importLibrary]: handler((payload, { window }) =>
      libraryFiles.importLibrary(ImportLibraryRequestSchema.parse(payload).kind, window),
    ),
    [IPC_CHANNELS.autoChargeSoon]: handler(() => pilot.chargeSoon(nowMs())),
    [IPC_CHANNELS.autoResume]: handler(() => pilot.resume()),
    [IPC_CHANNELS.autoSetPreheatHold]: handler((payload) => {
      pilot.choosePreheatHold(PreheatHoldRequestSchema.parse(payload).holdS);
    }),
    [IPC_CHANNELS.coachApply]: handler((payload) =>
      coach.apply(CoachRequestSchema.parse(payload).id),
    ),
    [IPC_CHANNELS.coachDismiss]: handler((payload) => {
      coach.dismiss(CoachRequestSchema.parse(payload).id);
    }),
    [IPC_CHANNELS.setRoastSetup]: handler((payload) => {
      beans.setSetup(RoastSetupSchema.parse(payload));
    }),
    [IPC_CHANNELS.saveRoastResult]: handler((payload) =>
      history.saveResult(RoastResultSchema.parse(payload)),
    ),
    [IPC_CHANNELS.makeProfileFromRoast]: handler((payload) =>
      makeProfile(MakeProfileRequestSchema.parse(payload)),
    ),
    ...profileIpcHandlers({ profiles }),
    ...beanIpcHandlers({ beans, openBeanLink, makeBeanProfile }),
    ...roasterIpcHandlers({ roasters, tc4 }),
    [IPC_CHANNELS.getAppInfo]: handler(() => updates.info()),
    [IPC_CHANNELS.checkForUpdates]: handler(() => updates.check()),
    [IPC_CHANNELS.restartToUpdate]: handler(() => updates.restart()),
    [IPC_CHANNELS.openReleasePage]: handler((payload) =>
      updates.openReleasePage(ReleasePageSchema.parse(payload)),
    ),
  };
}
