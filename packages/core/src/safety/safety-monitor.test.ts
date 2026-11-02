import { err, ok, type LogEntry, type Reading } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock';
import { createLogger } from '../logging/logger';
import { SafetyMonitor, type SafetyEvent } from './safety-monitor';

function setup() {
  const clock = new ManualClock();
  const events: SafetyEvent[] = [];
  let safeStops = 0;
  const monitor = new SafetyMonitor({
    clock,
    safeStop: () => {
      safeStops++;
      return Promise.resolve();
    },
    onEvent: (e) => events.push(e),
  });
  monitor.connected();
  const read = (bt: number, heater = 0) => {
    const reading: Reading = { atMs: clock.now(), values: { bt, heater } };
    monitor.recordRead(ok(reading));
  };
  return { clock, monitor, events, read, safeStops: () => safeStops };
}

const kinds = (events: SafetyEvent[]) =>
  events.map((e) => (e.kind === 'unlocked' ? 'unlocked' : `${e.kind}:${e.rule}`));

describe('SafetyMonitor', () => {
  describe('safe-stop rules', () => {
    it('trips once, safe-stops once and locks the heater', () => {
      const { clock, monitor, events, read, safeStops } = setup();
      read(241);
      clock.advance(1000);
      read(243);
      expect(kinds(events)).toEqual(['tripped:max-temperature']);
      expect(safeStops()).toBe(1);
      expect(monitor.locked).toBe(true);
    });

    it('clears when the condition goes away but stays locked until acknowledged', () => {
      const { clock, monitor, events, read } = setup();
      read(241);
      clock.advance(1000);
      read(230);
      expect(kinds(events)).toEqual(['tripped:max-temperature', 'cleared:max-temperature']);
      expect(monitor.locked).toBe(true);
      expect(monitor.acknowledge()).toEqual(ok(undefined));
      expect(monitor.locked).toBe(false);
      expect(kinds(events).at(-1)).toBe('unlocked');
    });

    it('refuses to acknowledge while still over the limit', () => {
      const { monitor, read } = setup();
      read(245);
      expect(monitor.acknowledge()).toEqual(
        err({ kind: 'still-tripped', rules: ['max-temperature'] }),
      );
      expect(monitor.locked).toBe(true);
    });

    it('keeps max roast time tripped until the roast ends', () => {
      const { clock, monitor, events, read } = setup();
      monitor.roastStarted();
      clock.advance(20 * 60_000);
      read(200); // fresh reading, so only the roast time is over
      expect(kinds(events)).toEqual(['tripped:max-roast-time']);
      expect(monitor.acknowledge().ok).toBe(false);
      monitor.roastEnded();
      expect(monitor.acknowledge().ok).toBe(true);
    });
  });

  describe('lost connection', () => {
    it('trips after 3 s without a valid reading, even if nothing reads', () => {
      const { clock, monitor, events, read, safeStops } = setup();
      read(150);
      clock.advance(2999);
      monitor.check();
      expect(events).toEqual([]);
      clock.advance(1);
      monitor.check();
      expect(kinds(events)).toEqual(['tripped:lost-connection']);
      expect(safeStops()).toBe(1);
    });

    it('counts failed reads and readings without a temperature as no reading', () => {
      const { clock, monitor, events } = setup();
      for (let i = 0; i < 3; i++) {
        clock.advance(1000);
        monitor.recordRead(
          i % 2
            ? err({ kind: 'no-reply', command: 'READ' })
            : ok({ atMs: clock.now(), values: { heater: 0 } }),
        );
      }
      expect(kinds(events)).toEqual(['tripped:lost-connection']);
    });

    it('safe-stops again when readings come back, then clears', () => {
      const { clock, monitor, events, read, safeStops } = setup();
      clock.advance(3000);
      monitor.check(); // the app's 1 s timer
      read(150);
      expect(kinds(events)).toEqual(['tripped:lost-connection', 'cleared:lost-connection']);
      expect(safeStops()).toBe(2);
    });

    it('stays tripped through a reconnect until a reading arrives', () => {
      const { clock, monitor, events, read, safeStops } = setup();
      clock.advance(3000);
      monitor.check();
      monitor.connected();
      expect(monitor.tripped).toEqual(['lost-connection']);
      read(150);
      expect(kinds(events)).toEqual(['tripped:lost-connection', 'cleared:lost-connection']);
      expect(safeStops()).toBe(2);
    });

    it('cannot trip before the roaster has connected', () => {
      const clock = new ManualClock();
      const events: SafetyEvent[] = [];
      const monitor = new SafetyMonitor({
        clock,
        safeStop: () => Promise.resolve(),
        onEvent: (e) => events.push(e),
      });
      clock.advance(60_000);
      monitor.check();
      expect(events).toEqual([]);
    });
  });

  describe('alarm rules', () => {
    it('alarm on a frozen reading while heating, without a safe stop or lock', () => {
      const { clock, monitor, events, read, safeStops } = setup();
      for (let i = 0; i <= 10; i++) {
        read(120.5, 40);
        clock.advance(1000);
      }
      expect(kinds(events)).toEqual(['tripped:frozen-reading']);
      expect(events[0]).toMatchObject({ action: 'alarm' });
      expect(safeStops()).toBe(0);
      expect(monitor.locked).toBe(false);
    });

    it('keeps enough history for a 60 s window after hours of readings', () => {
      const { clock, events, read } = setup();
      for (let i = 0; i < 3600; i++) {
        read(100 + i * 0.5, 60);
        clock.advance(1000);
      }
      for (let i = 0; i <= 60; i++) {
        read(1900, 60);
        clock.advance(1000);
      }
      expect(kinds(events)).toContain('tripped:slow-rise');
    });
  });
});

describe('SafetyMonitor emergency stop and disconnect', () => {
  it('emergency stop safe-stops and locks, and can be acknowledged straight away', () => {
    const { monitor, events, safeStops } = setup();
    monitor.emergencyStop();
    expect(kinds(events)).toEqual(['tripped:emergency-stop']);
    expect(safeStops()).toBe(1);
    expect(monitor.locked).toBe(true);
    expect(monitor.acknowledge()).toEqual(ok(undefined));
    expect(monitor.locked).toBe(false);
  });

  it('a deliberate disconnect disarms lost connection until the next connect', () => {
    const { clock, monitor, events } = setup();
    monitor.disconnected();
    clock.advance(60_000);
    monitor.check();
    expect(events).toEqual([]);
    monitor.connected();
    clock.advance(3000);
    monitor.check();
    expect(kinds(events)).toEqual(['tripped:lost-connection']);
  });
});

describe('SafetyMonitor when the driver breaks its contract', () => {
  it('logs a safe stop that rejects instead of losing it', async () => {
    const entries: LogEntry[] = [];
    const clock = new ManualClock();
    const monitor = new SafetyMonitor({
      clock,
      safeStop: () => Promise.reject(new Error('port exploded')),
      onEvent: () => undefined,
      logger: createLogger({ write: (e) => entries.push(e) }, 'safety'),
    });
    monitor.emergencyStop();
    await Promise.resolve();
    await Promise.resolve();
    expect(entries.map((e) => [e.level, e.event])).toEqual([
      ['error', 'safety.safe-stop-rejected'],
    ]);
    expect(entries[0]?.context?.error).toMatchObject({ message: 'port exploded' });
  });
});
