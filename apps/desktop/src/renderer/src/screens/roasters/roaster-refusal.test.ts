import { describe, expect, it } from 'vitest';
import { refusalText } from './roaster-refusal';

describe('refusalText', () => {
  it('asks to disconnect while a roaster is in use', () => {
    expect(refusalText({ kind: 'in-use' }, 'save')).toBe('Disconnect first');
  });

  it('points to the log otherwise', () => {
    expect(refusalText({ kind: 'not-found', id: 3 }, 'switch roasters')).toBe(
      "Couldn't switch roasters · see the log",
    );
  });
});
