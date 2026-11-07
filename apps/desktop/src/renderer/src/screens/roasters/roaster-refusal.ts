import type { RoasterError } from '@roastpilot/shared';

/** One line for a roaster change main refused: what to do first, or where to look. */
export function refusalText(error: RoasterError, action: string): string {
  return error.kind === 'in-use' ? 'Disconnect first' : `Couldn't ${action} · see the log`;
}
