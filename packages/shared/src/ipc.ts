import { z } from 'zod';
import { AutoStatusSchema, type AutoStatus } from './auto-status';
import { RoastSetupSchema, type Bean } from './bean';
import { ReadingSchema, type Reading } from './channels';
import { ConnectionStateSchema, type ConnectionState } from './connection';
import type { LogRecord } from './log-record';
import type { Roaster } from './roaster';
import { RoastStateSchema, type RoastState } from './roast';
import { RoastIdSchema, type RoastId } from './saved-roast';
import type { Screen } from './screen';
import type { SafetyEvent } from './safety-event';

/** A saved roast changed; `current` when it's the roast on the Roast screen. */
export interface RoastsChange {
  id: RoastId;
  deleted: boolean;
  current?: boolean;
}

/** Every IPC channel, in one place (docs/spec/architecture.md, IPC contract). */
export const IPC_CHANNELS = {
  listPorts: 'roaster:list-ports',
  connect: 'roaster:connect',
  disconnect: 'roaster:disconnect',
  setOutput: 'roaster:set-output',
  emergencyStop: 'roaster:emergency-stop',
  acknowledgeSafety: 'safety:acknowledge',
  reading: 'roaster:reading',
  connection: 'roaster:connection',
  safetyEvent: 'safety:event',
  log: 'app:log',
  getSnapshot: 'app:get-snapshot',
  roastAction: 'roast:action',
  roast: 'roast:state',
  getSettings: 'settings:get',
  setSettings: 'settings:set',
  listLogDays: 'logs:list-days',
  readLogDay: 'logs:read-day',
  logEntries: 'logs:entries',
  openLogFolder: 'logs:open-folder',
  navigate: 'app:navigate',
  listRoasts: 'history:list',
  getRoast: 'history:get',
  deleteRoast: 'history:delete',
  exportRoasts: 'history:export',
  importRoasts: 'history:import',
  setRoastBean: 'history:set-bean',
  importArtisan: 'history:import-artisan',
  roastsChanged: 'history:changed',
  autoStatus: 'auto:status',
  autoChargeSoon: 'auto:charge-soon',
  autoResume: 'auto:resume',
  listProfiles: 'profiles:list',
  duplicateProfile: 'profiles:duplicate',
  saveProfile: 'profiles:save',
  deleteProfile: 'profiles:delete',
  copyProfile: 'profiles:copy',
  makeProfileFromMilestones: 'profiles:make-from-milestones',
  listRoasters: 'roasters:list',
  addRoaster: 'roasters:add',
  saveRoaster: 'roasters:save',
  deleteRoaster: 'roasters:delete',
  setActiveRoaster: 'roasters:set-active',
  chooseConnection: 'roasters:choose-connection',
  roastersChanged: 'roasters:changed',
  listBeans: 'beans:list',
  addBean: 'beans:add',
  updateBean: 'beans:update',
  setBeanArchived: 'beans:set-archived',
  addStock: 'beans:add-stock',
  adjustStock: 'beans:adjust-stock',
  beansChanged: 'beans:changed',
  setRoastSetup: 'roast:set-setup',
  saveRoastResult: 'history:save-result',
  makeProfileFromRoast: 'history:make-profile',
} as const;

/** Everything a window needs when it opens or reloads mid-roast. */
export const SnapshotSchema = z.object({
  connection: ConnectionStateSchema,
  roast: RoastStateSchema,
  /** Readings of the current roast (or the last minutes before one). */
  readings: z.array(ReadingSchema),
  safety: z.object({ locked: z.boolean(), tripped: z.array(z.string()) }),
  auto: AutoStatusSchema,
  setup: RoastSetupSchema,
  /** The roast on screen, once its row exists; null with none. */
  currentRoastId: RoastIdSchema.nullable(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

/** Payload of each main → renderer event, so senders and listeners share one type. */
export interface IpcEventPayloads {
  [IPC_CHANNELS.reading]: Reading;
  [IPC_CHANNELS.connection]: ConnectionState;
  [IPC_CHANNELS.safetyEvent]: SafetyEvent;
  [IPC_CHANNELS.roast]: RoastState;
  [IPC_CHANNELS.logEntries]: LogRecord[];
  [IPC_CHANNELS.navigate]: Screen;
  [IPC_CHANNELS.roastsChanged]: RoastsChange;
  [IPC_CHANNELS.autoStatus]: AutoStatus;
  [IPC_CHANNELS.roastersChanged]: Roaster[];
  [IPC_CHANNELS.beansChanged]: Bean[];
}
export type IpcEventChannel = keyof IpcEventPayloads;

export const SetOutputRequestSchema = z.object({
  channel: z.string().min(1),
  value: z.number(),
});
export type SetOutputRequest = z.infer<typeof SetOutputRequestSchema>;
