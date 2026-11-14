// The only API the renderer can call, typed by the IPC contract in @roastpilot/shared.
import {
  IPC_CHANNELS,
  type InvokeArgs,
  type InvokeChannel,
  type InvokeResult,
  type IpcEventChannel,
  type IpcEventPayloads,
  type RoastpilotApi,
  type Unsubscribe,
} from '@roastpilot/shared';
import { contextBridge, ipcRenderer } from 'electron';

/**
 * Calls main on an invoke channel. The payload and the answer are the channel's in
 * `InvokeContract`, which main's handlers are checked against, so this cast is the one place the
 * renderer trusts main's answer.
 */
function invoke<C extends InvokeChannel>(
  channel: C,
  ...args: InvokeArgs<C>
): Promise<InvokeResult<C>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<InvokeResult<C>>;
}

function subscribe<C extends IpcEventChannel>(
  channel: C,
  listener: (payload: IpcEventPayloads[C]) => void,
): Unsubscribe {
  const handler = (_event: unknown, payload: IpcEventPayloads[C]) => {
    listener(payload);
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api: RoastpilotApi = {
  listPorts: () => invoke(IPC_CHANNELS.listPorts),
  connect: (target) => invoke(IPC_CHANNELS.connect, target),
  disconnect: () => invoke(IPC_CHANNELS.disconnect),
  setOutput: (request) => invoke(IPC_CHANNELS.setOutput, request),
  emergencyStop: () => invoke(IPC_CHANNELS.emergencyStop),
  acknowledgeSafety: () => invoke(IPC_CHANNELS.acknowledgeSafety),
  onReading: (listener) => subscribe(IPC_CHANNELS.reading, listener),
  onConnection: (listener) => subscribe(IPC_CHANNELS.connection, listener),
  onSafetyEvent: (listener) => subscribe(IPC_CHANNELS.safetyEvent, listener),
  getSnapshot: () => invoke(IPC_CHANNELS.getSnapshot),
  onNavigate: (listener) => subscribe(IPC_CHANNELS.navigate, listener),
  onShowSafetyNotice: (listener) =>
    subscribe(IPC_CHANNELS.showSafetyNotice, () => {
      listener();
    }),
  listRoasts: () => invoke(IPC_CHANNELS.listRoasts),
  getRoast: (id) => invoke(IPC_CHANNELS.getRoast, id),
  deleteRoast: (id) => invoke(IPC_CHANNELS.deleteRoast, id),
  exportRoasts: (request) => invoke(IPC_CHANNELS.exportRoasts, request),
  importRoasts: () => invoke(IPC_CHANNELS.importRoasts),
  setRoastBean: (request) => invoke(IPC_CHANNELS.setRoastBean, request),
  importArtisan: () => invoke(IPC_CHANNELS.importArtisan),
  exportLibrary: (request) => invoke(IPC_CHANNELS.exportLibrary, request),
  importLibrary: (kind) => invoke(IPC_CHANNELS.importLibrary, { kind }),
  onRoastsChanged: (listener) => subscribe(IPC_CHANNELS.roastsChanged, listener),
  roastAction: (action) => invoke(IPC_CHANNELS.roastAction, action),
  onRoast: (listener) => subscribe(IPC_CHANNELS.roast, listener),
  getSettings: () => invoke(IPC_CHANNELS.getSettings),
  setSettings: (settings) => invoke(IPC_CHANNELS.setSettings, settings),
  listLogDays: () => invoke(IPC_CHANNELS.listLogDays),
  readLogDay: (day) => invoke(IPC_CHANNELS.readLogDay, day),
  onLogEntries: (listener) => subscribe(IPC_CHANNELS.logEntries, listener),
  openLogFolder: () => invoke(IPC_CHANNELS.openLogFolder),
  autoChargeSoon: () => invoke(IPC_CHANNELS.autoChargeSoon),
  autoResume: () => invoke(IPC_CHANNELS.autoResume),
  autoSetPreheatHold: (request) => invoke(IPC_CHANNELS.autoSetPreheatHold, request),
  onAutoStatus: (listener) => subscribe(IPC_CHANNELS.autoStatus, listener),
  coachApply: (request) => invoke(IPC_CHANNELS.coachApply, request),
  coachDismiss: (request) => invoke(IPC_CHANNELS.coachDismiss, request),
  onCoachStatus: (listener) => subscribe(IPC_CHANNELS.coachStatus, listener),
  listProfiles: () => invoke(IPC_CHANNELS.listProfiles),
  duplicateProfile: (id) => invoke(IPC_CHANNELS.duplicateProfile, id),
  saveProfile: (profile) => invoke(IPC_CHANNELS.saveProfile, profile),
  deleteProfile: (id) => invoke(IPC_CHANNELS.deleteProfile, id),
  deleteProfiles: (ids) => invoke(IPC_CHANNELS.deleteProfiles, ids),
  copyProfile: (request) => invoke(IPC_CHANNELS.copyProfile, request),
  makeProfileFromMilestones: (milestones) =>
    invoke(IPC_CHANNELS.makeProfileFromMilestones, milestones),
  onProfiles: (listener) => subscribe(IPC_CHANNELS.profilesChanged, listener),
  listBeans: () => invoke(IPC_CHANNELS.listBeans),
  addBean: (fields) => invoke(IPC_CHANNELS.addBean, fields),
  updateBean: (update) => invoke(IPC_CHANNELS.updateBean, update),
  setBeanArchived: (request) => invoke(IPC_CHANNELS.setBeanArchived, request),
  openBeanLink: (id) => invoke(IPC_CHANNELS.openBeanLink, id),
  addStock: (stock) => invoke(IPC_CHANNELS.addStock, stock),
  adjustStock: (stock) => invoke(IPC_CHANNELS.adjustStock, stock),
  stockHistory: (id) => invoke(IPC_CHANNELS.stockHistory, id),
  onBeans: (listener) => subscribe(IPC_CHANNELS.beansChanged, listener),
  makeBeanProfile: (request) => invoke(IPC_CHANNELS.makeBeanProfile, request),
  setRoastSetup: (setup) => invoke(IPC_CHANNELS.setRoastSetup, setup),
  saveRoastResult: (result) => invoke(IPC_CHANNELS.saveRoastResult, result),
  makeProfileFromRoast: (request) => invoke(IPC_CHANNELS.makeProfileFromRoast, request),
  listRoasters: () => invoke(IPC_CHANNELS.listRoasters),
  addRoaster: (roaster) => invoke(IPC_CHANNELS.addRoaster, roaster),
  saveRoaster: (roaster) => invoke(IPC_CHANNELS.saveRoaster, roaster),
  saveRoasterWiring: (request) => invoke(IPC_CHANNELS.saveRoasterWiring, request),
  readRoasterInputs: () => invoke(IPC_CHANNELS.readRoasterInputs),
  deleteRoaster: (id) => invoke(IPC_CHANNELS.deleteRoaster, id),
  setActiveRoaster: (id) => invoke(IPC_CHANNELS.setActiveRoaster, id),
  chooseConnection: (target) => invoke(IPC_CHANNELS.chooseConnection, target),
  onRoasters: (listener) => subscribe(IPC_CHANNELS.roastersChanged, listener),
  getAppInfo: () => invoke(IPC_CHANNELS.getAppInfo),
  checkForUpdates: () => invoke(IPC_CHANNELS.checkForUpdates),
  restartToUpdate: () => invoke(IPC_CHANNELS.restartToUpdate),
  openReleasePage: (page) => invoke(IPC_CHANNELS.openReleasePage, page),
  onUpdateStatus: (listener) => subscribe(IPC_CHANNELS.updateStatus, listener),
  log: (entry) => {
    ipcRenderer.send(IPC_CHANNELS.log, entry);
  },
};

contextBridge.exposeInMainWorld('roastpilot', api);
