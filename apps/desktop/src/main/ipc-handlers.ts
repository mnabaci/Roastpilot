import {
  AddStockSchema,
  AdjustStockSchema,
  AutoProfileSchema,
  BeanFieldsSchema,
  MakeBeanProfileRequestSchema,
  MakeProfileRequestSchema,
  RoastResultSchema,
  PreheatHoldRequestSchema,
  RoastSetupSchema,
  SetArchivedSchema,
  UpdateBeanSchema,
  ConnectTargetSchema,
  CopyProfileRequestSchema,
  MilestonesSchema,
  IPC_CHANNELS,
  LogDaySchema,
  NewRoasterSchema,
  ProfileIdSchema,
  DeleteProfilesRequestSchema,
  RoasterIdSchema,
  RoasterSchema,
  RoastActionSchema,
  ExportLibraryRequestSchema,
  ExportRoastsRequestSchema,
  ImportLibraryRequestSchema,
  ReleasePageSchema,
  RoastIdSchema,
  SetRoastBeanRequestSchema,
  SetOutputRequestSchema,
  SettingsSchema,
  CoachRequestSchema,
} from '@roastpilot/shared';
import type { IpcCaller, IpcDeps, IpcHandler } from './ipc-deps';

export type { IpcCaller, IpcDeps, IpcHandler } from './ipc-deps';
export { handleRendererLog, withErrorLogging } from './ipc-logging';

/** Runs `fn` so that anything it throws, a failed validation included, becomes a rejected promise. */
function handler(fn: (payload: unknown, caller: IpcCaller) => unknown): IpcHandler {
  return (payload, caller) => Promise.resolve().then(() => fn(payload, caller));
}

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
  nowMs,
  snapshot,
  listPorts,
  createDriver,
  updates,
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
    [IPC_CHANNELS.deleteProfiles]: handler((payload) =>
      profiles.deleteMany(DeleteProfilesRequestSchema.parse(payload)),
    ),
    [IPC_CHANNELS.copyProfile]: handler((payload) => {
      const { id, roasterId } = CopyProfileRequestSchema.parse(payload);
      return profiles.copyTo(id, roasterId);
    }),
    [IPC_CHANNELS.makeProfileFromMilestones]: handler((payload) =>
      profiles.fromMilestones(MilestonesSchema.parse(payload)),
    ),
    [IPC_CHANNELS.listBeans]: handler(() => beans.list()),
    [IPC_CHANNELS.addBean]: handler((payload) => beans.add(BeanFieldsSchema.parse(payload))),
    [IPC_CHANNELS.updateBean]: handler((payload) => beans.update(UpdateBeanSchema.parse(payload))),
    [IPC_CHANNELS.setBeanArchived]: handler((payload) =>
      beans.setArchived(SetArchivedSchema.parse(payload)),
    ),
    [IPC_CHANNELS.addStock]: handler((payload) => beans.addStock(AddStockSchema.parse(payload))),
    [IPC_CHANNELS.adjustStock]: handler((payload) =>
      beans.adjustStock(AdjustStockSchema.parse(payload)),
    ),
    [IPC_CHANNELS.makeBeanProfile]: handler((payload) =>
      makeBeanProfile(MakeBeanProfileRequestSchema.parse(payload)),
    ),
    [IPC_CHANNELS.setRoastSetup]: handler((payload) => {
      beans.setSetup(RoastSetupSchema.parse(payload));
    }),
    [IPC_CHANNELS.saveRoastResult]: handler((payload) =>
      history.saveResult(RoastResultSchema.parse(payload)),
    ),
    [IPC_CHANNELS.makeProfileFromRoast]: handler((payload) =>
      makeProfile(MakeProfileRequestSchema.parse(payload)),
    ),
    [IPC_CHANNELS.listRoasters]: handler(() => roasters.load()),
    [IPC_CHANNELS.addRoaster]: handler((payload) => roasters.add(NewRoasterSchema.parse(payload))),
    [IPC_CHANNELS.saveRoaster]: handler((payload) => roasters.save(RoasterSchema.parse(payload))),
    [IPC_CHANNELS.deleteRoaster]: handler((payload) =>
      roasters.delete(RoasterIdSchema.parse(payload)),
    ),
    [IPC_CHANNELS.setActiveRoaster]: handler((payload) =>
      roasters.setActive(RoasterIdSchema.parse(payload)),
    ),
    [IPC_CHANNELS.chooseConnection]: handler((payload) =>
      roasters.chooseConnection(ConnectTargetSchema.parse(payload)),
    ),
    [IPC_CHANNELS.getAppInfo]: handler(() => updates.info()),
    [IPC_CHANNELS.checkForUpdates]: handler(() => updates.check()),
    [IPC_CHANNELS.restartToUpdate]: handler(() => updates.restart()),
    [IPC_CHANNELS.openReleasePage]: handler((payload) =>
      updates.openReleasePage(ReleasePageSchema.parse(payload)),
    ),
  };
}
