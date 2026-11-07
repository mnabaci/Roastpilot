import type {
  AutoPilot,
  Clock,
  Coach,
  Logger,
  ManualRoast,
  BeanRepository,
  ProfileRepository,
  RoasterRepository,
  RoastRecorder,
  RoastRepository,
  RoasterSession,
  SettingsStore,
} from '@roastpilot/core';
import type {
  ConnectionState,
  IpcEventChannel,
  IpcEventPayloads,
  RoastState,
  Settings,
  Snapshot,
} from '@roastpilot/shared';
import type { BeanService } from './beans/bean-service';
import type { CoachActions } from './coach-apply';
import type { HandOutput } from './hand-output';
import type { HistoryService } from './history/history-service';
import type { RoastFileService } from './history/roast-file-service';
import type { ProfileService } from './profiles/profile-service';
import type { RoasterService } from './roasters/roaster-service';
import type { SettingsService } from './settings/settings-service';

/** What main's services are made from: the stores, time, logging and the app around them. */
export interface AppServicesDeps {
  clock: Clock;
  logger: Logger;
  settingsStore: SettingsStore;
  roasts: RoastRepository;
  profileStore: ProfileRepository;
  roasterStore: RoasterRepository;
  beanStore: BeanRepository;
  /** New ids for your own profiles. */
  newProfileId: () => string;
  /** Wall-clock time as ISO 8601, for saved roasts. */
  nowIso: () => string;
  /** Every connection change, besides the windows (the power guard). */
  onConnectionChange: (state: ConnectionState) => void;
  /** Every roast change, besides the windows (the power guard). */
  onRoastChange?: (state: RoastState) => void;
  /** Every settings load and save, besides Auto (the window theme). */
  onSettingsChange?: (settings: Settings) => void;
  /** Sends an event to every window. */
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
}

/** Everything main runs, for the IPC handlers, quit and crash paths. */
export interface AppServices {
  session: RoasterSession;
  roast: ManualRoast;
  settings: SettingsService;
  history: HistoryService;
  roastFiles: RoastFileService;
  recorder: RoastRecorder;
  pilot: AutoPilot;
  coach: Coach;
  coachActions: CoachActions;
  /** The sliders' path to the roaster, which the coach's Apply takes too. */
  setOutputByHand: HandOutput;
  profiles: ProfileService;
  roasters: RoasterService;
  beans: BeanService;
  snapshot: () => Snapshot;
}
