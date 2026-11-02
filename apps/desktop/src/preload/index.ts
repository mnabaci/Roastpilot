// The only API the renderer can call. Every method is typed by the IPC contract in
// @roastpilot/shared and filled in from milestone 2.
import { contextBridge } from 'electron';
import type { RoastpilotApi } from '@roastpilot/shared';

const api: RoastpilotApi = {};

contextBridge.exposeInMainWorld('roastpilot', api);
