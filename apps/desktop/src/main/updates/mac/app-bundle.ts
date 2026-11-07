import { accessSync, constants } from 'node:fs';
import { posix } from 'node:path';

/** `/Applications/Roastpilot.app` from `/Applications/Roastpilot.app/Contents/MacOS/Roastpilot`. */
export function appBundlePath(exe: string): string | undefined {
  const parts = exe.split('/');
  const end = parts.findIndex((part) => part.endsWith('.app'));
  return end < 1 ? undefined : parts.slice(0, end + 1).join('/');
}

/** Why this copy can't put a new version in its own place. */
export type CantReplaceReason = 'not-a-bundle' | 'translocated' | 'disk-image' | 'read-only';

/**
 * Whether the running app can replace itself (docs/spec/install-and-update.md, Mac installer):
 * not from the DMG, not a translocated copy, and in a folder it may write.
 */
export function cantReplaceReason(
  bundle: string | undefined,
  canWrite: (dir: string) => boolean,
): CantReplaceReason | undefined {
  if (bundle === undefined) return 'not-a-bundle';
  if (bundle.includes('/AppTranslocation/')) return 'translocated';
  if (bundle.startsWith('/Volumes/')) return 'disk-image';
  if (!canWrite(posix.dirname(bundle))) return 'read-only';
  return undefined;
}

/** Whether this user may create and rename files in `dir` (the folder holding the app). */
export function isWritable(dir: string): boolean {
  try {
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false; // Missing or read-only: either way the app can't be replaced there.
  }
}
