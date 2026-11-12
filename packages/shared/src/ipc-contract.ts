import type { AutoChargeSoonError, AutoResumeError } from './auto-status';
import type {
  AddStock,
  AdjustStock,
  Bean,
  BeanFields,
  BeanId,
  OpenBeanLinkError,
  RoastSetup,
  StockMovement,
  UpdateBean,
} from './bean';
import type { CoachApplyError, CoachRequest } from './coach';
import type { ConnectTarget, SerialPortInfo } from './connection';
import type { ConnectError, DriverError } from './driver-error';
import {
  INVOKE_CHANNELS,
  type EVENT_CHANNELS,
  type IpcEventChannel,
  type PreheatHoldRequest,
  type SetOutputRequest,
  type Snapshot,
} from './ipc';
import type {
  ExportLibraryError,
  ExportLibraryRequest,
  ExportLibraryResult,
  ImportLibraryError,
  ImportLibraryRequest,
  ImportLibraryResult,
} from './library-file';
import type { LogDay, LogDayRead } from './log-record';
import type {
  MakeBeanProfileError,
  MakeBeanProfileRequest,
  MakeProfileError,
  MakeProfileRequest,
} from './make-profile';
import type { Milestones } from './milestones';
import type { AutoProfile, ProfileEntry, ProfileError, ProfileId } from './profile';
import type { Result } from './result';
import type { RoastAction, RoastActionError } from './roast';
import type { ExportRoastsRequest, SetRoastBeanRequest } from './roast-file';
import type { EnvelopeProblem } from './roastpilot-file';
import type { NewRoaster, Roaster, RoasterError, RoasterId } from './roaster';
import type { AcknowledgeError } from './safety-event';
import type {
  DeleteRoastError,
  RoastDetail,
  RoastId,
  RoastResult,
  RoastSummary,
  StorageError,
} from './saved-roast';
import type { Settings, SettingsWriteError } from './settings';
import type {
  AppInfo,
  OpenReleasePageError,
  ReleasePage,
  RestartToUpdateError,
} from './update-status';

export type ExportRoastsResult = { status: 'cancelled' } | { status: 'saved'; fileName: string };
export type ExportRoastsError = StorageError | { kind: 'write-failed' };
export type ImportArtisanResult = { status: 'cancelled' } | { status: 'imported'; id: RoastId };
export type ImportArtisanError =
  StorageError | { kind: 'read-failed' } | { kind: 'too-big' } | { kind: 'not-artisan' };
export type ImportRoastsResult =
  | { status: 'cancelled' }
  /** `newestId`: the newest roast added, for History to open; null when all were already here. */
  | { status: 'imported'; added: number; skipped: number; newestId: RoastId | null };
export type ImportRoastsError =
  StorageError | { kind: 'read-failed' } | { kind: 'too-big' } | EnvelopeProblem;

/** One invoke call: what the renderer sends (`undefined`: nothing) and what main answers. */
interface Call<Payload, Result> {
  payload: Payload;
  result: Result;
}

const C = INVOKE_CHANNELS;

/**
 * Every invoke call's payload and result, by channel (docs/spec/architecture.md, IPC contract):
 * the one place both sides take their types from. Main's handlers are a mapped type over it
 * (`IpcHandlers`), the preload's `invoke` and `RoastpilotApi` read it, so a handler that answers
 * another shape, or a missing one, fails tsc. Payloads are still parsed with zod in main.
 */
export interface InvokeContract {
  [C.listPorts]: Call<undefined, SerialPortInfo[]>;
  [C.connect]: Call<ConnectTarget, Result<void, ConnectError>>;
  [C.disconnect]: Call<undefined, void>;
  [C.setOutput]: Call<SetOutputRequest, Result<void, DriverError>>;
  [C.emergencyStop]: Call<undefined, void>;
  [C.acknowledgeSafety]: Call<undefined, Result<void, AcknowledgeError>>;
  [C.getSnapshot]: Call<undefined, Snapshot>;
  [C.roastAction]: Call<RoastAction, Result<void, RoastActionError>>;
  [C.getSettings]: Call<undefined, Settings>;
  [C.setSettings]: Call<Settings, Result<Settings, SettingsWriteError>>;
  [C.listLogDays]: Call<undefined, LogDay[]>;
  [C.readLogDay]: Call<LogDay, LogDayRead>;
  [C.openLogFolder]: Call<undefined, void>;
  [C.listRoasts]: Call<undefined, RoastSummary[]>;
  [C.getRoast]: Call<RoastId, Result<RoastDetail, StorageError>>;
  [C.deleteRoast]: Call<RoastId, Result<void, DeleteRoastError>>;
  [C.exportRoasts]: Call<ExportRoastsRequest, Result<ExportRoastsResult, ExportRoastsError>>;
  [C.importRoasts]: Call<undefined, Result<ImportRoastsResult, ImportRoastsError>>;
  [C.setRoastBean]: Call<SetRoastBeanRequest, Result<void, StorageError>>;
  [C.importArtisan]: Call<undefined, Result<ImportArtisanResult, ImportArtisanError>>;
  [C.exportLibrary]: Call<ExportLibraryRequest, Result<ExportLibraryResult, ExportLibraryError>>;
  [C.importLibrary]: Call<ImportLibraryRequest, Result<ImportLibraryResult, ImportLibraryError>>;
  [C.autoChargeSoon]: Call<undefined, Result<void, AutoChargeSoonError>>;
  [C.autoResume]: Call<undefined, Result<void, AutoResumeError>>;
  [C.autoSetPreheatHold]: Call<PreheatHoldRequest, void>;
  [C.coachApply]: Call<CoachRequest, Result<void, CoachApplyError>>;
  [C.coachDismiss]: Call<CoachRequest, void>;
  [C.listProfiles]: Call<undefined, ProfileEntry[]>;
  [C.duplicateProfile]: Call<ProfileId, Result<ProfileEntry, ProfileError>>;
  [C.saveProfile]: Call<AutoProfile, Result<ProfileEntry, ProfileError>>;
  [C.deleteProfile]: Call<ProfileId, Result<void, ProfileError>>;
  [C.deleteProfiles]: Call<readonly ProfileId[], Result<void, ProfileError>>;
  [C.copyProfile]: Call<
    { id: ProfileId; roasterId: RoasterId },
    Result<ProfileEntry, ProfileError>
  >;
  [C.makeProfileFromMilestones]: Call<Milestones, Result<ProfileEntry, ProfileError>>;
  [C.listRoasters]: Call<undefined, Roaster[]>;
  [C.addRoaster]: Call<NewRoaster, Result<Roaster, RoasterError>>;
  [C.saveRoaster]: Call<Roaster, Result<Roaster, RoasterError>>;
  [C.deleteRoaster]: Call<RoasterId, Result<void, RoasterError>>;
  [C.setActiveRoaster]: Call<RoasterId, Result<void, RoasterError>>;
  [C.chooseConnection]: Call<ConnectTarget, Result<void, RoasterError>>;
  [C.listBeans]: Call<undefined, Bean[]>;
  [C.addBean]: Call<BeanFields, Result<BeanId, StorageError>>;
  [C.updateBean]: Call<UpdateBean, Result<void, StorageError>>;
  [C.setBeanArchived]: Call<{ id: BeanId; archived: boolean }, Result<void, StorageError>>;
  [C.openBeanLink]: Call<BeanId, Result<void, OpenBeanLinkError>>;
  [C.addStock]: Call<AddStock, Result<void, StorageError>>;
  [C.adjustStock]: Call<AdjustStock, Result<void, StorageError>>;
  [C.stockHistory]: Call<BeanId, Result<StockMovement[], StorageError>>;
  [C.makeBeanProfile]: Call<MakeBeanProfileRequest, Result<ProfileEntry, MakeBeanProfileError>>;
  [C.setRoastSetup]: Call<RoastSetup, void>;
  [C.saveRoastResult]: Call<RoastResult, Result<void, StorageError>>;
  [C.makeProfileFromRoast]: Call<MakeProfileRequest, Result<ProfileEntry, MakeProfileError>>;
  [C.getAppInfo]: Call<undefined, AppInfo>;
  [C.checkForUpdates]: Call<undefined, void>;
  [C.restartToUpdate]: Call<undefined, Result<void, RestartToUpdateError>>;
  [C.openReleasePage]: Call<ReleasePage, Result<void, OpenReleasePageError>>;
}

export type InvokeChannel = keyof InvokeContract;
export type InvokePayload<Ch extends InvokeChannel> = InvokeContract[Ch]['payload'];
export type InvokeResult<Ch extends InvokeChannel> = InvokeContract[Ch]['result'];
/** The arguments after the channel: none for an `undefined` payload, else the payload. */
export type InvokeArgs<Ch extends InvokeChannel> = [InvokePayload<Ch>] extends [undefined]
  ? []
  : [payload: InvokePayload<Ch>];

/** The renderer's call for one channel, as `RoastpilotApi` and the preload write it. */
export type Invoke<Ch extends InvokeChannel> = (
  ...args: InvokeArgs<Ch>
) => Promise<InvokeResult<Ch>>;

/** Every invoke channel, for a runtime walk (registration, tests). */
export const INVOKE_CHANNEL_LIST: readonly InvokeChannel[] = Object.values(INVOKE_CHANNELS);

// The channel lists and the contracts must name the same channels: these fail tsc if one is
// added without the other.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type ChannelOf<T> = T[keyof T];
export type ContractMatchesChannels = [
  Assert<Same<InvokeChannel, ChannelOf<typeof INVOKE_CHANNELS>>>,
  Assert<Same<IpcEventChannel, ChannelOf<typeof EVENT_CHANNELS>>>,
];
