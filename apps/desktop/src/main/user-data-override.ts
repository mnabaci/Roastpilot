// Imported first by index.ts, so it runs before anything reads `userData` or `logs`.
// ROASTPILOT_USER_DATA=<absolute dir> runs a development build on a throwaway data folder
// (database, settings, logs, updates), so UI checks never touch the real one.
import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chooseUserData } from './user-data-dir';

export const userDataChoice = chooseUserData(process.env, app.isPackaged);

if (userDataChoice.kind === 'override') {
  // setPath throws for a folder that doesn't exist yet.
  mkdirSync(userDataChoice.dir, { recursive: true });
  app.setPath('userData', userDataChoice.dir);
  // On macOS `logs` is ~/Library/Logs/<name>, not under userData: move it too.
  app.setAppLogsPath(join(userDataChoice.dir, 'logs'));
}
