import type { CoachApplyError } from '@roastpilot/shared';

/**
 * What a refused Apply says in a toast, if anything: the safety lock and a lost roaster have their
 * own banners, and a roast that no longer allows it has already taken the card away.
 */
export function coachApplyFailed(error: CoachApplyError): string | undefined {
  switch (error.kind) {
    case 'stale':
      return 'The suggestion changed · check the card';
    case 'not-now':
    case 'safety-locked':
    case 'disconnected':
      return undefined;
    default:
      return "Couldn't apply the suggestion · try again";
  }
}
