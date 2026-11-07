import { ok } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { handOutput } from './hand-output';

describe('handOutput', () => {
  it('tells the roast, Auto and the coach before the session sends it', async () => {
    const calls: unknown[][] = [];
    const set = handOutput({
      roast: { outputRequested: (c, v) => calls.push(['roast', c, v]) },
      // Auto keeps it yours until Resume auto; the coach starts again from your heater.
      pilot: { outputRequested: (c, v) => calls.push(['pilot', c, v]) },
      coach: { outputRequested: (c, v) => calls.push(['coach', c, v]) },
      session: {
        setOutput: (c, v) => {
          calls.push(['session', c, v]);
          return Promise.resolve(ok(undefined));
        },
      },
    });
    expect(await set('heater', 50)).toEqual(ok(undefined));
    expect(calls).toEqual([
      ['roast', 'heater', 50],
      ['pilot', 'heater', 50],
      ['coach', 'heater', 50],
      ['session', 'heater', 50],
    ]);
  });
});
