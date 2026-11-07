import type { UpdateStatus } from '@roastpilot/shared';

/** The one button About shows for an update state, if any. */
export type UpdateAction = 'check' | 'restart' | 'download';

export interface UpdateCopy {
  line: string;
  action?: UpdateAction;
  /** The button shows but can't be pressed yet (a check under way). */
  busy?: boolean;
}

/** "14:02", in the computer's time zone. */
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** The line and button per state (docs/spec/install-and-update.md, What you see). */
export function updateCopy(status: UpdateStatus | null): UpdateCopy {
  if (status === null) return { line: '–' };
  switch (status.state) {
    case 'off':
      return { line: 'Updates are off in development' };
    case 'idle':
      return {
        line: status.checkedAt
          ? `Up to date · checked ${clockTime(status.checkedAt)}`
          : 'Not checked yet',
        action: 'check',
      };
    case 'checking':
      return { line: 'Checking…', action: 'check', busy: true };
    case 'downloading':
      return { line: `Downloading ${status.version} · ${String(status.percent)} %` };
    case 'ready':
      return { line: `${status.version} is ready · installs when you quit`, action: 'restart' };
    case 'available':
      return { line: `Version ${status.version} is out`, action: 'download' };
    case 'failed':
      return { line: "Couldn't check · try again", action: 'check' };
  }
}
