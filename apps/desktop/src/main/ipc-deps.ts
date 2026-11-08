import type { AutoPilot, ManualRoast, RoasterDriver, RoasterSession } from '@roastpilot/core';
import type {
  ConnectTarget,
  LogDay,
  LogDayRead,
  MakeBeanProfileError,
  MakeBeanProfileRequest,
  MakeProfileError,
  MakeProfileRequest,
  ProfileEntry,
  Result,
  SerialPortInfo,
  Snapshot,
} from '@roastpilot/shared';
import type { BeanService } from './beans/bean-service';
import type { CoachActions } from './coach-apply';
import type { HandOutput } from './hand-output';
import type { HistoryService } from './history/history-service';
import type { DialogParent } from './files/file-dialogs';
import type { RoastFiles } from './history/roast-files';
import type { LibraryFileActions } from './files/library-file-actions';
import type { ProfileService } from './profiles/profile-service';
import type { RoasterService } from './roasters/roaster-service';
import type { SettingsService } from './settings/settings-service';
import type { Updates } from './updates/update-wiring';

/** What the IPC handlers reach in main: the services each channel calls. */
export interface IpcDeps {
  session: Pick<RoasterSession, 'connect' | 'disconnect' | 'emergencyStop' | 'acknowledgeSafety'>;
  roast: Pick<ManualRoast, 'act'>;
  /** The sliders' path to the roaster (hand-output.ts). */
  setOutputByHand: HandOutput;
  coach: CoachActions;
  settings: Pick<SettingsService, 'get' | 'set'>;
  history: Pick<HistoryService, 'list' | 'get' | 'delete' | 'saveResult' | 'setBean'>;
  roastFiles: RoastFiles;
  /** Beans, profiles and roasters as Roastpilot files. */
  libraryFiles: LibraryFileActions;
  pilot: Pick<AutoPilot, 'chargeSoon' | 'resume'>;
  profiles: Pick<
    ProfileService,
    'list' | 'duplicate' | 'copyTo' | 'save' | 'delete' | 'deleteMany' | 'fromMilestones'
  >;
  roasters: Pick<
    RoasterService,
    'load' | 'add' | 'save' | 'delete' | 'setActive' | 'chooseConnection'
  >;
  beans: Pick<
    BeanService,
    'list' | 'add' | 'update' | 'setArchived' | 'addStock' | 'adjustStock' | 'setSetup'
  >;
  makeProfile: (request: MakeProfileRequest) => Promise<Result<ProfileEntry, MakeProfileError>>;
  makeBeanProfile: (
    request: MakeBeanProfileRequest,
  ) => Promise<Result<ProfileEntry, MakeBeanProfileError>>;
  /** The clock's now, for Charge soon. */
  nowMs: () => number;
  snapshot: () => Snapshot;
  listPorts: () => Promise<SerialPortInfo[]>;
  createDriver: (target: ConnectTarget) => RoasterDriver;
  updates: Pick<Updates, 'info' | 'check' | 'restart' | 'openReleasePage'>;
  logs: {
    listDays: () => Promise<LogDay[]>;
    readDay: (day: LogDay) => Promise<LogDayRead>;
    openFolder: () => Promise<void>;
  };
}

/** Who made a call: the app window it came from, checked in `ipc.ts`. Dialogs open on it. */
export interface IpcCaller {
  window: DialogParent;
}

export type IpcHandler = (payload: unknown, caller: IpcCaller) => Promise<unknown>;
