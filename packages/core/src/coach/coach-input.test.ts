import { describe, expect, it } from 'vitest';
import { gapsOf } from './coach-input';

describe('gapsOf', () => {
  it("is how far Auto's setting is from yours, per output, either way", () => {
    expect(gapsOf({ set: { heater: 60, fan: 50 }, wants: { heater: 75, fan: 40 } })).toEqual({
      heater: 15,
      fan: 10,
    });
  });

  it('is 0 for an output the roaster has not reported', () => {
    expect(
      gapsOf({ set: { heater: undefined, fan: undefined }, wants: { heater: 75, fan: 40 } }),
    ).toEqual({ heater: 0, fan: 0 });
  });
});
