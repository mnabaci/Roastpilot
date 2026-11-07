import { describe, expect, it } from 'vitest';
import { roastActionFailed, roastActionRefused } from './roast-action-failed';

describe('roast action toasts', () => {
  it('say what failed and what to do', () => {
    expect(roastActionFailed('drop')).toBe("Couldn't mark drop · try again");
    expect(roastActionRefused('first-crack')).toBe(
      "Can't mark first crack now · the roast has moved on",
    );
  });
});
