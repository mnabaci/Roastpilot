import { describe, expect, it } from 'vitest';
import { voiceLengthMs } from './voices';

describe('voiceLengthMs', () => {
  it("runs from the first note's start to the last note's end; None is silent", () => {
    expect(voiceLengthMs('chime')).toBe(500);
    expect(voiceLengthMs('alert')).toBe(580);
    expect(voiceLengthMs('bell')).toBe(1_200);
    expect(voiceLengthMs('none')).toBe(0);
  });
});
