import { describe, expect, it } from 'vitest';
import { phaseBandEdges } from './phase-bands';

const none = {
  profileDryEndC: undefined,
  expectedFirstCrackC: undefined,
  dryEndAtC: undefined,
  firstCrackAtC: undefined,
};

describe('phaseBandEdges', () => {
  it("sits at the profile's dry end and the expected first crack", () => {
    expect(phaseBandEdges({ ...none, profileDryEndC: 150, expectedFirstCrackC: 192 })).toEqual({
      dryEndC: 150,
      firstCrackC: 192,
    });
  });

  it('moves to the real temperature when dry end and first crack happen', () => {
    expect(
      phaseBandEdges({
        profileDryEndC: 150,
        expectedFirstCrackC: 192,
        dryEndAtC: 151.4,
        firstCrackAtC: 190.6,
      }),
    ).toEqual({ dryEndC: 151.4, firstCrackC: 190.6 });
  });

  it('dries to 150 °C without a profile and expects no first crack without one to expect', () => {
    expect(phaseBandEdges(none)).toEqual({ dryEndC: 150, firstCrackC: undefined });
  });

  it('ignores a first crack expected at or below dry end', () => {
    expect(phaseBandEdges({ ...none, profileDryEndC: 150, expectedFirstCrackC: 148 })).toEqual({
      dryEndC: 150,
      firstCrackC: undefined,
    });
  });
});
