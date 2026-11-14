import { ManualClock } from '@roastpilot/core';
import { describe, expect, it } from 'vitest';
import { FakeTransport } from './fake-transport';
import { skyCommandDialect } from './sky-command-dialect';
import { checkDialect, type Tc4Dialect } from './tc4-dialect';
import { Tc4Driver } from './tc4-driver';

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

  it('refuses a safe stop on an output that has no command', () => {
    const noHeaterCommand = Object.fromEntries(
      Object.entries(skyCommandDialect.outputCommands).filter(([channel]) => channel !== 'heater'),
    );
    expect(() => {
      checkDialect(broken({ outputCommands: noHeaterCommand }));
    }).toThrow(/safe stop: heater/);
  });

  it('refuses a dialect without a fan output, which READ always echoes', () => {
    expect(() => {
      checkDialect(
        broken({
          channels: skyCommandDialect.channels.filter((c) => c.id !== 'fan'),
          safeStop: [['heater', 0]],
          fallbackStop: { command: 'ESTOP', leaves: { heater: 0 } },
        }),
      );
    }).toThrow(/no fan output/);
  });

  it('refuses a sensor named like an output', () => {
    expect(() => {
      checkDialect(
        broken({
          channels: [
            ...skyCommandDialect.channels,
            { id: 'fan', kind: 'sensor', unit: 'celsius', name: 'Fan', short: 'Fan' },
          ],
        }),
      );
    }).toThrow(/sensor named like an output: fan/);
  });

  it('refuses a fallback that leaves the heater on', () => {
    expect(() => {
      checkDialect(broken({ fallbackStop: { command: 'ESTOP', leaves: { heater: 50 } } }));
    }).toThrow(/fallback never leaves the heater at 0/);
  });
});

describe('Tc4Driver', () => {
  it('refuses to be built with a broken dialect', () => {
    const clock = new ManualClock();
    expect(
      () =>
        new Tc4Driver({
          dialect: broken({ safeStop: [['fan', 100]] }),
          transport: new FakeTransport(clock),
          clock,
        }),
    ).toThrow(/Bad TC4 dialect/);
  });
});
