import { err, ok, type Result } from '@roastpilot/shared';
import { spawn } from 'node:child_process';
import { errorMessage } from '../electron-updater-adapter';
import type { StepFailure } from './run-command';

/** What the helper swaps, and where it says how it went. */
export interface SwapRequest {
  /** The app's process: the helper waits for it to end. */
  pid: number;
  installed: string;
  staged: string;
  /** Start the new version afterwards (Restart to update), or not (a plain quit). */
  relaunch: boolean;
  log: string;
}

/** A started process, as far as the app cares once it lets go of it. */
export interface DetachedChild {
  on(event: 'error', listener: (error: Error) => void): unknown;
  unref(): void;
}

export type SpawnDetached = (command: string, args: readonly string[]) => DetachedChild;

/** Starts a program that outlives the app: its own process group, no pipes back. */
export const spawnDetached: SpawnDetached = (command, args) =>
  spawn(command, [...args], { detached: true, stdio: 'ignore' });

/**
 * Starts the swap helper (resources/mac-update-swap.sh) and lets go of it: it waits for the app to
 * end, then swaps the bundles. A helper that won't start is a failure here, or a logged `error`
 * event when the system says so later.
 */
export function startSwapHelper(
  script: string,
  request: SwapRequest,
  spawnHelper: SpawnDetached,
  onError: (error: Error) => void,
): Result<void, StepFailure> {
  const { pid, installed, staged, relaunch, log } = request;
  try {
    const child = spawnHelper('/bin/sh', [
      script,
      String(pid),
      installed,
      staged,
      relaunch ? '1' : '0',
      log,
    ]);
    child.on('error', onError);
    child.unref();
    return ok(undefined);
  } catch (error) {
    return err({ message: errorMessage(error) });
  }
}
