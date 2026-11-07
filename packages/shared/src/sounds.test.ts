import { describe, expect, it } from 'vitest';
import { DEFAULT_STEP_SOUNDS, sameStepSound } from './sounds';

describe('sameStepSound', () => {
  const chime = DEFAULT_STEP_SOUNDS['charge-soon'];

  it('is the same only when voice, volume and repeat all match', () => {
    expect(sameStepSound(chime, { ...chime })).toBe(true);
    expect(sameStepSound(chime, { ...chime, voice: 'bell' })).toBe(false);
    expect(sameStepSound(chime, { ...chime, volumePct: 75 })).toBe(false);
    expect(sameStepSound(chime, { ...chime, repeat: 'once' })).toBe(false);
  });
});
