import type { ConnectionState } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { connectedHasOutput } from './connected-output';

const connected: ConnectionState = {
  status: 'connected',
  target: { kind: 'serial', path: 'COM3' },
  channels: [
    { id: 'bt', kind: 'sensor', unit: 'celsius', name: 'Temperature', short: 'Temp' },
    { id: 'heater', kind: 'output', unit: 'percent', min: 0, max: 100, step: 5 },
  ],
};

describe('connectedHasOutput', () => {
  it("is true for the connected roaster's outputs only, never its sensors", () => {
    expect(connectedHasOutput(connected, 'heater')).toBe(true);
    expect(connectedHasOutput(connected, 'cooling')).toBe(false);
    expect(connectedHasOutput(connected, 'bt')).toBe(false);
  });

  it('lets the command through with no roaster connected, for the session to refuse', () => {
    expect(connectedHasOutput({ status: 'disconnected' }, 'cooling')).toBe(true);
  });
});
