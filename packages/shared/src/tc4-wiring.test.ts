import { describe, expect, it } from 'vitest';
import { DEFAULT_TC4_WIRING, Tc4WiringSchema } from './tc4-wiring';

describe('Tc4WiringSchema', () => {
  it('takes the firmware defaults', () => {
    expect(Tc4WiringSchema.safeParse(DEFAULT_TC4_WIRING).success).toBe(true);
  });

  it('takes no ET probe as input 0', () => {
    expect(Tc4WiringSchema.safeParse({ ...DEFAULT_TC4_WIRING, etInput: 0 }).success).toBe(true);
  });

  it('refuses ET on the bean probe input, next to the ET field', () => {
    const parsed = Tc4WiringSchema.safeParse({ ...DEFAULT_TC4_WIRING, etInput: 2 });
    expect(parsed.error?.issues).toMatchObject([
      { path: ['etInput'], message: 'Already the bean probe' },
    ]);
  });

  it('refuses the fan on the heater output', () => {
    const parsed = Tc4WiringSchema.safeParse({
      ...DEFAULT_TC4_WIRING,
      heaterOutput: 'IO3',
      fanOutput: 'IO3',
    });
    expect(parsed.error?.issues).toMatchObject([
      { path: ['fanOutput'], message: "Already the heater's output" },
    ]);
  });

  it('refuses a baud the setting does not offer', () => {
    expect(Tc4WiringSchema.safeParse({ ...DEFAULT_TC4_WIRING, baud: 250000 }).success).toBe(false);
  });
});
