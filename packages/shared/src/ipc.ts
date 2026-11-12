import { z } from 'zod';
import { AutoStatusSchema, type AutoStatus } from './auto-status';
import { CoachStatusSchema, type CoachStatus } from './coach';
import { RoastSetupSchema, type Bean } from './bean';
import { ReadingSchema, type Reading } from './channels';
import { ConnectionStateSchema, type ConnectionState } from './connection';
import { PREHEAT_HOLD, type ProfileEntry } from './profile';
import type { LogRecord } from './log-record';
import type { Roaster } from './roaster';
import { RoastStateSchema, type RoastState } from './roast';
import { RoastIdSchema, type RoastId } from './saved-roast';
import type { Screen } from './screen';
import type { SafetyEvent } from './safety-event';
import type { UpdateStatus } from './update-status';

/** A saved roast changed; `current` when it's the roast on the Roast screen. */
export interface RoastsChange {
  id: RoastId;
  deleted: boolean;
  current?: boolean;
}

/** Renderer → main calls that answer: each has its payload and result in `InvokeContract`. */
export const INVOKE_CHANNELS = {
  listPorts: 'roaster:list-ports',
  connect: 'roaster:connect',
  disconnect: 'roaster:disconnect',
  setOutput: 'roaster:set-output',
  emergencyStop: 'roaster:emergency-stop',
  acknowledgeSafety: 'safety:acknowledge',
  getSnapshot: 'app:get-snapshot',
  roastAction: 'roast:action',
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  listLogDays: 'logs:list-days',
  readLogDay: 'logs:read-day',
  openLogFolder: 'logs:open-folder',
  listRoasts: 'history:list',
  getRoast: 'history:get',
  deleteRoast: 'history:delete',
  exportRoasts: 'history:export',
  importRoasts: 'history:import',
  setRoastBean: 'history:set-bean',
  importArtisan: 'history:import-artisan',
  exportLibrary: 'library:export',
  importLibrary: 'library:import',
  autoChargeSoon: 'auto:charge-soon',
  autoResume: 'auto:resume',
  autoSetPreheatHold: 'auto:set-preheat-hold',
  coachApply: 'coach:apply',
  coachDismiss: 'coach:dismiss',
  listProfiles: 'profiles:list',
  duplicateProfile: 'profiles:duplicate',
  saveProfile: 'profiles:save',
  deleteProfile: 'profiles:delete',
  deleteProfiles: 'profiles:delete-many',
  copyProfile: 'profiles:copy',
  makeProfileFromMilestones: 'profiles:make-from-milestones',
  listRoasters: 'roasters:list',
  addRoaster: 'roasters:add',
  saveRoaster: 'roasters:save',
  deleteRoaster: 'roasters:delete',
  setActiveRoaster: 'roasters:set-active',
  chooseConnection: 'roasters:choose-connection',
  listBeans: 'beans:list',
  addBean: 'beans:add',
  updateBean: 'beans:update',
  setBeanArchived: 'beans:set-archived',
  openBeanLink: 'beans:open-link',
  addStock: 'beans:add-stock',
  adjustStock: 'beans:adjust-stock',
  stockHistory: 'beans:stock-history',
  makeBeanProfile: 'beans:make-profile',
  setRoastSetup: 'roast:set-setup',
  saveRoastResult: 'history:save-result',
  makeProfileFromRoast: 'history:make-profile',
  getAppInfo: 'app:get-info',
  checkForUpdates: 'updates:check',
  restartToUpdate: 'updates:restart',
  openReleasePage: 'updates:open-release-page',
} as const;

/** Main → renderer events: each has its payload in `IpcEventPayloads`. */
export const EVENT_CHANNELS = {
  reading: 'roaster:reading',
  connection: 'roaster:connection',
  safetyEvent: 'safety:event',
  roast: 'roast:state',
  logEntries: 'logs:entries',
  navigate: 'app:navigate',
  showSafetyNotice: 'app:show-safety-notice',
  roastsChanged: 'history:changed',
  autoStatus: 'auto:status',
  coachStatus: 'coach:status',
  profilesChanged: 'profiles:changed',
  roastersChanged: 'roasters:changed',
  beansChanged: 'beans:changed',
  updateStatus: 'updates:status',
} as const;

/** Renderer → main messages with no answer: the renderer's log. */
export const SEND_CHANNELS = {
  log: 'app:log',
} as const;

/** Every IPC channel, in one place (docs/spec/architecture.md, IPC contract). */
export const IPC_CHANNELS = {
  ...INVOKE_CHANNELS,
  ...EVENT_CHANNELS,
  ...SEND_CHANNELS,
} as const;

/** Everything a window needs when it opens or reloads mid-roast. */
export const SnapshotSchema = z.object({
  connection: ConnectionStateSchema,
  roast: RoastStateSchema,
  /** Readings of the current roast (or the last minutes before one). */
  readings: z.array(ReadingSchema),
  safety: z.object({ locked: z.boolean(), tripped: z.array(z.string()) }),
  auto: AutoStatusSchema,
  coach: CoachStatusSchema,
  setup: RoastSetupSchema,
  /** The roast on screen, once its row exists; null with none. */
  currentRoastId: RoastIdSchema.nullable(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

/** Payload of each main → renderer event, so senders and listeners share one type. */
export interface IpcEventPayloads {
  [EVENT_CHANNELS.reading]: Reading;
  [EVENT_CHANNELS.connection]: ConnectionState;
  [EVENT_CHANNELS.safetyEvent]: SafetyEvent;
  [EVENT_CHANNELS.roast]: RoastState;
  [EVENT_CHANNELS.logEntries]: LogRecord[];
  [EVENT_CHANNELS.navigate]: Screen;
  [EVENT_CHANNELS.showSafetyNotice]: null;
  [EVENT_CHANNELS.roastsChanged]: RoastsChange;
  [EVENT_CHANNELS.autoStatus]: AutoStatus;
  [EVENT_CHANNELS.coachStatus]: CoachStatus;
  [EVENT_CHANNELS.profilesChanged]: ProfileEntry[];
  [EVENT_CHANNELS.roastersChanged]: Roaster[];
  [EVENT_CHANNELS.beansChanged]: Bean[];
  [EVENT_CHANNELS.updateStatus]: UpdateStatus;
}
export type IpcEventChannel = keyof IpcEventPayloads;

export const SetOutputRequestSchema = z.object({
  channel: z.string().min(1),
  value: z.number(),
});
export type SetOutputRequest = z.infer<typeof SetOutputRequestSchema>;

/**
 * This roast's preheat hold, chosen on the setup card (docs/spec/roast-control.md, Roast phases
 * 1.3); null goes back to the one picked for the batch. Never saved to the roaster.
 */
export const PreheatHoldRequestSchema = z.object({
  holdS: z
    .number()
    .int()
    .min(PREHEAT_HOLD.minS)
    .max(PREHEAT_HOLD.maxS)
    .multipleOf(PREHEAT_HOLD.stepS)
    .nullable(),
});
export type PreheatHoldRequest = z.infer<typeof PreheatHoldRequestSchema>;
