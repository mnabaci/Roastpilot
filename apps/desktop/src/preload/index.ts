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
  roastAction: (action) => ipcRenderer.invoke(IPC_CHANNELS.roastAction, action),
  onRoast: (listener) => subscribe(IPC_CHANNELS.roast, listener),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  setSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.setSettings, settings),
  listLogDays: () => ipcRenderer.invoke(IPC_CHANNELS.listLogDays),
  readLogDay: (day) => ipcRenderer.invoke(IPC_CHANNELS.readLogDay, day),
  onLogEntries: (listener) => subscribe(IPC_CHANNELS.logEntries, listener),
  openLogFolder: () => ipcRenderer.invoke(IPC_CHANNELS.openLogFolder),
  log: (entry) => {
    ipcRenderer.send(IPC_CHANNELS.log, entry);
  },
};

contextBridge.exposeInMainWorld('roastpilot', api);
