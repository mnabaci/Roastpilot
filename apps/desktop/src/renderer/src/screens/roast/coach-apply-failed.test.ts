import { describe, expect, it } from 'vitest';
import { coachApplyFailed } from './coach-apply-failed';

describe('coachApplyFailed', () => {
  it('says the card changed when it did', () => {
    expect(coachApplyFailed({ kind: 'stale' })).toBe('The suggestion changed · check the card');
  });

  it('stays quiet where a banner or the screen already says why', () => {
    expect(coachApplyFailed({ kind: 'not-now' })).toBeUndefined();
    expect(coachApplyFailed({ kind: 'safety-locked', channel: 'heater' })).toBeUndefined();
    expect(coachApplyFailed({ kind: 'disconnected' })).toBeUndefined();
  });

  it('asks to try again when the roaster did not answer', () => {
    expect(coachApplyFailed({ kind: 'no-reply', command: 'OT1' })).toBe(
      "Couldn't apply the suggestion · try again",
    );
  });
});
