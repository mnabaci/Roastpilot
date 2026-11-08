// The only API the renderer can call, typed by the IPC contract in @roastpilot/shared.
import {
  IPC_CHANNELS,
  type IpcEventChannel,
  type IpcEventPayloads,
  type RoastpilotApi,
  type Unsubscribe,
} from '@roastpilot/shared';
import { contextBridge, ipcRenderer } from 'electron';

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
  listPorts: () => ipcRenderer.invoke(IPC_CHANNELS.listPorts),
  connect: (target) => ipcRenderer.invoke(IPC_CHANNELS.connect, target),
  disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.disconnect),
  setOutput: (request) => ipcRenderer.invoke(IPC_CHANNELS.setOutput, request),
  emergencyStop: () => ipcRenderer.invoke(IPC_CHANNELS.emergencyStop),
  acknowledgeSafety: () => ipcRenderer.invoke(IPC_CHANNELS.acknowledgeSafety),
  onReading: (listener) => subscribe(IPC_CHANNELS.reading, listener),
  onConnection: (listener) => subscribe(IPC_CHANNELS.connection, listener),
  onSafetyEvent: (listener) => subscribe(IPC_CHANNELS.safetyEvent, listener),
  getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.getSnapshot),
  onNavigate: (listener) => subscribe(IPC_CHANNELS.navigate, listener),
  onShowSafetyNotice: (listener) =>
    subscribe(IPC_CHANNELS.showSafetyNotice, () => {
      listener();
    }),
  listRoasts: () => ipcRenderer.invoke(IPC_CHANNELS.listRoasts),
  getRoast: (id) => ipcRenderer.invoke(IPC_CHANNELS.getRoast, id),
  deleteRoast: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteRoast, id),
  exportRoasts: (request) => ipcRenderer.invoke(IPC_CHANNELS.exportRoasts, request),
  importRoasts: () => ipcRenderer.invoke(IPC_CHANNELS.importRoasts),
  setRoastBean: (request) => ipcRenderer.invoke(IPC_CHANNELS.setRoastBean, request),
  importArtisan: () => ipcRenderer.invoke(IPC_CHANNELS.importArtisan),
  exportLibrary: (request) => ipcRenderer.invoke(IPC_CHANNELS.exportLibrary, request),
  importLibrary: (kind) => ipcRenderer.invoke(IPC_CHANNELS.importLibrary, { kind }),
  onRoastsChanged: (listener) => subscribe(IPC_CHANNELS.roastsChanged, listener),
  roastAction: (action) => ipcRenderer.invoke(IPC_CHANNELS.roastAction, action),
  onRoast: (listener) => subscribe(IPC_CHANNELS.roast, listener),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  setSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.setSettings, settings),
  listLogDays: () => ipcRenderer.invoke(IPC_CHANNELS.listLogDays),
  readLogDay: (day) => ipcRenderer.invoke(IPC_CHANNELS.readLogDay, day),
  onLogEntries: (listener) => subscribe(IPC_CHANNELS.logEntries, listener),
  openLogFolder: () => ipcRenderer.invoke(IPC_CHANNELS.openLogFolder),
  autoChargeSoon: () => ipcRenderer.invoke(IPC_CHANNELS.autoChargeSoon),
  autoResume: () => ipcRenderer.invoke(IPC_CHANNELS.autoResume),
  onAutoStatus: (listener) => subscribe(IPC_CHANNELS.autoStatus, listener),
  coachApply: (request) => ipcRenderer.invoke(IPC_CHANNELS.coachApply, request),
  coachDismiss: (request) => ipcRenderer.invoke(IPC_CHANNELS.coachDismiss, request),
  onCoachStatus: (listener) => subscribe(IPC_CHANNELS.coachStatus, listener),
  listProfiles: () => ipcRenderer.invoke(IPC_CHANNELS.listProfiles),
  duplicateProfile: (id) => ipcRenderer.invoke(IPC_CHANNELS.duplicateProfile, id),
  saveProfile: (profile) => ipcRenderer.invoke(IPC_CHANNELS.saveProfile, profile),
  deleteProfile: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteProfile, id),
  copyProfile: (request) => ipcRenderer.invoke(IPC_CHANNELS.copyProfile, request),
  makeProfileFromMilestones: (milestones) =>
    ipcRenderer.invoke(IPC_CHANNELS.makeProfileFromMilestones, milestones),
  listBeans: () => ipcRenderer.invoke(IPC_CHANNELS.listBeans),
  addBean: (fields) => ipcRenderer.invoke(IPC_CHANNELS.addBean, fields),
  updateBean: (update) => ipcRenderer.invoke(IPC_CHANNELS.updateBean, update),
  setBeanArchived: (request) => ipcRenderer.invoke(IPC_CHANNELS.setBeanArchived, request),
  addStock: (stock) => ipcRenderer.invoke(IPC_CHANNELS.addStock, stock),
  adjustStock: (stock) => ipcRenderer.invoke(IPC_CHANNELS.adjustStock, stock),
  onBeans: (listener) => subscribe(IPC_CHANNELS.beansChanged, listener),
  makeBeanProfile: (request) => ipcRenderer.invoke(IPC_CHANNELS.makeBeanProfile, request),
  setRoastSetup: (setup) => ipcRenderer.invoke(IPC_CHANNELS.setRoastSetup, setup),
  saveRoastResult: (result) => ipcRenderer.invoke(IPC_CHANNELS.saveRoastResult, result),
  makeProfileFromRoast: (request) => ipcRenderer.invoke(IPC_CHANNELS.makeProfileFromRoast, request),
  listRoasters: () => ipcRenderer.invoke(IPC_CHANNELS.listRoasters),
  addRoaster: (roaster) => ipcRenderer.invoke(IPC_CHANNELS.addRoaster, roaster),
  saveRoaster: (roaster) => ipcRenderer.invoke(IPC_CHANNELS.saveRoaster, roaster),
  deleteRoaster: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteRoaster, id),
  setActiveRoaster: (id) => ipcRenderer.invoke(IPC_CHANNELS.setActiveRoaster, id),
  chooseConnection: (target) => ipcRenderer.invoke(IPC_CHANNELS.chooseConnection, target),
  onRoasters: (listener) => subscribe(IPC_CHANNELS.roastersChanged, listener),
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getAppInfo),
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.checkForUpdates),
  restartToUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.restartToUpdate),
  openReleasePage: (page) => ipcRenderer.invoke(IPC_CHANNELS.openReleasePage, page),
  onUpdateStatus: (listener) => subscribe(IPC_CHANNELS.updateStatus, listener),
  log: (entry) => {
    ipcRenderer.send(IPC_CHANNELS.log, entry);
  },
};

contextBridge.exposeInMainWorld('roastpilot', api);
