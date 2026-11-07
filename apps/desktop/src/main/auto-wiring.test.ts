import type { ConnectionState } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { heaterLocked, noteAutoEvent, roundOutput } from './auto-wiring';

const CONNECTED: ConnectionState = {
  status: 'connected',
  target: { kind: 'simulator' },
  channels: [
    { id: 'heater', kind: 'output', unit: 'percent', min: 0, max: 100, step: 5 },
    { id: 'bt', kind: 'sensor', unit: 'celsius', name: 'Bean', short: 'BT' },
  ],
};

describe('roundOutput', () => {
  it("clamps and rounds to the connected roaster's output", () => {
    const round = roundOutput({ connection: CONNECTED });
    expect(round('heater', 67)).toBe(65);
    expect(round('heater', 120)).toBe(100);
  });

  it('leaves a channel that is no output, or any with no roaster connected, as it is', () => {
    expect(roundOutput({ connection: CONNECTED })('bt', 67)).toBe(67);
    expect(roundOutput({ connection: { status: 'disconnected' } })('heater', 67)).toBe(67);
  });
});

describe('heaterLocked', () => {
  it('is locked unless connected and free of a safety lock', () => {
    const locked = (connection: ConnectionState, isLocked: boolean) =>
      heaterLocked({ connection, safetyStatus: { locked: isLocked, tripped: [] } })();
    expect(locked(CONNECTED, false)).toBe(false);
    expect(locked(CONNECTED, true)).toBe(true);
    expect(locked({ status: 'disconnected' }, false)).toBe(true);
  });
});

describe('noteAutoEvent', () => {
  it('puts each thing Auto did on the roast, with its detail', () => {
    const noted: [string, string | undefined][] = [];
    const roast = { note: (kind: string, detail?: string) => noted.push([kind, detail]) };
    noteAutoEvent(roast, { kind: 'phase', name: 'Maillard' });
    noteAutoEvent(roast, { kind: 'dry-end' });
    noteAutoEvent(roast, { kind: 'stall-guard', tripped: true });
    noteAutoEvent(roast, { kind: 'stall-guard', tripped: false });
    noteAutoEvent(roast, { kind: 'override', channel: 'fan', value: 40 });
    noteAutoEvent(roast, { kind: 'mode', auto: true });
    noteAutoEvent(roast, { kind: 'mode', auto: false });
    expect(noted).toEqual([
      ['phase', 'Maillard'],
      ['dry-end', undefined],
      ['stall-guard', 'tripped'],
      ['stall-guard', 'cleared'],
      ['override', 'fan 40'],
      ['mode', 'auto'],
      ['mode', 'manual'],
    ]);
  });
});
