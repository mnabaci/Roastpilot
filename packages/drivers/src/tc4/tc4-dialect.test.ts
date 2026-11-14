import { describe, expect, it } from 'vitest';
import { skyCommandDialect } from './sky-command-dialect';
import { checkDialect, type Tc4Dialect } from './tc4-dialect';

const broken = (change: Partial<Tc4Dialect>): Tc4Dialect => ({ ...skyCommandDialect, ...change });

describe('checkDialect', () => {
  it('takes the SkyCommand dialect', () => {
    expect(() => {
      checkDialect(skyCommandDialect);
    }).not.toThrow();
  });

  it('refuses a safe stop naming an output the board does not have', () => {
    expect(() => {
      checkDialect(
        broken({
          safeStop: [
            ['heater', 0],
            ['blower', 100],
          ],
        }),
      );
    }).toThrow(/safe stop: blower/);
  });

  it('refuses a safe stop that never switches the heater off', () => {
    expect(() => {
      checkDialect(broken({ safeStop: [['fan', 100]] }));
    }).toThrow(/heater to 0/);
  });

  it('refuses a fallback that leaves a value for a channel that is not an output', () => {
    expect(() => {
      checkDialect(broken({ fallbackStop: { command: 'ESTOP', leaves: { bt: 0 } } }));
    }).toThrow(/fallback leaves: bt/);
  });
});
