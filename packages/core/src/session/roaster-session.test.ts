import {
  err,
  ok,
  type Channel,
  type ConnectionState,
  type LogEntry,
  type Reading,
  type Result,
  type SafetyEvent,
} from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock';
import { createLogger } from '../logging/logger';
import { DEFAULT_SAFETY_LIMITS } from '../safety/safety-limits';
import type { DriverError, RoasterDriver } from '../roaster-driver';
import { RoasterSession, SAFE_STOP_TIMEOUT_MS } from './roaster-session';

const TARGET = { kind: 'serial', path: '/dev/cu.test' } as const;

const CHANNELS: Channel[] = [
  { id: 'bt', kind: 'sensor', unit: 'celsius', name: 'Temperature', short: 'Temp' },
];

/** A roaster whose cable you can pull, and whose reads or safe stop you can make hang. */
class FakeRoaster implements RoasterDriver {
  readonly channels = CHANNELS;
  readonly log: string[] = [];
  plugged = true;
  bt = 25;
  hangReads = false;
  hangSafeStop = false;
  #connected = false;
  readonly #clock: ManualClock;

  constructor(clock: ManualClock) {
    this.#clock = clock;
  }

  connect(): Promise<Result<void, DriverError>> {
    this.log.push('connect');
    this.#connected = this.plugged;
    return Promise.resolve(this.plugged ? ok(undefined) : err({ kind: 'disconnected' }));
  }

  read(): Promise<Result<Reading, DriverError>> {
    this.log.push('read');
    if (this.hangReads) return new Promise(() => undefined);
    if (!this.plugged || !this.#connected) return Promise.resolve(err({ kind: 'disconnected' }));
    return Promise.resolve(ok({ atMs: this.#clock.now(), values: { bt: this.bt, heater: 0 } }));
  }

  setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
    this.log.push(`${channel}=${String(value)}`);
    return Promise.resolve(ok(undefined));
  }

  safeStop(): Promise<void> {
    this.log.push('safeStop');
    return this.hangSafeStop ? new Promise(() => undefined) : Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.log.push('disconnect');
    this.#connected = false;
    return Promise.resolve();
  }

  unplug(): void {
    this.plugged = false;
    this.#connected = false;
  }

  count(entry: string): number {
    return this.log.filter((e) => e === entry).length;
  }
}

function setup() {
  const clock = new ManualClock();
  const roaster = new FakeRoaster(clock);
  const readings: Reading[] = [];
  const states: ConnectionState['status'][] = [];
  const events: SafetyEvent[] = [];
  const session = new RoasterSession({
    clock,
    onReading: (r) => readings.push(r),
    onConnection: (s) => states.push(s.status),
    onSafetyEvent: (e) => events.push(e),
  });
  const tripped = () => events.flatMap((e) => (e.kind === 'tripped' ? [e.rule] : []));
  return { clock, roaster, session, readings, states, events, tripped };
}

describe('RoasterSession', () => {
  it('connects, then polls READ every second and publishes readings', async () => {
    const { clock, roaster, session, readings, states } = setup();
    expect(await session.connect(roaster, TARGET)).toEqual(ok(undefined));
    expect(states).toEqual(['connecting', 'connected']);
    await clock.runFor(3500);
    expect(readings.map((r) => r.atMs)).toEqual([0, 1000, 2000, 3000]);
  });

  it('publishes the channels on connect', async () => {
    const { clock, roaster } = setup();
    const seen: ConnectionState[] = [];
    const session = new RoasterSession({
      clock,
      onReading: () => undefined,
      onConnection: (s) => seen.push(s),
      onSafetyEvent: () => undefined,
    });
    await session.connect(roaster, TARGET);
    expect(seen.at(-1)).toEqual({ status: 'connected', target: TARGET, channels: CHANNELS });
  });

  it('reports a failed connect and stays disconnected', async () => {
    const { roaster, session, states } = setup();
    roaster.plugged = false;
    expect(await session.connect(roaster, TARGET)).toEqual(err({ kind: 'disconnected' }));
    expect(states).toEqual(['connecting', 'disconnected']);
    expect(await session.setOutput('heater', 50)).toEqual(err({ kind: 'disconnected' }));
  });

  it('disconnects with a safe stop first, stops polling and never alarms afterwards', async () => {
    const { clock, roaster, session, states, events } = setup();
    await session.connect(roaster, TARGET);
    await clock.runFor(2000);
    await session.disconnect();
    expect(roaster.log.slice(-2)).toEqual(['safeStop', 'disconnect']);
    expect(states.at(-1)).toBe('disconnected');
    const reads = roaster.count('read');
    await clock.runFor(60_000);
    expect(roaster.count('read')).toBe(reads);
    expect(events).toEqual([]);
  });

  it('gives the safe stop 2 s on disconnect, then closes anyway', async () => {
    const { clock, roaster, session } = setup();
    await session.connect(roaster, TARGET);
    roaster.hangSafeStop = true;
    const done = session.disconnect();
    await clock.runFor(SAFE_STOP_TIMEOUT_MS);
    await done;
    expect(roaster.log.at(-1)).toBe('disconnect');
  });

  describe('lost connection', () => {
    it('goes lost after 3 s, keeps reconnecting, and safe-stops again with the first reading back', async () => {
      const { clock, roaster, session, states, tripped } = setup();
      await session.connect(roaster, TARGET);
      await clock.runFor(1000);
      roaster.unplug();
      await clock.runFor(4000);
      expect(tripped()).toEqual(['lost-connection']);
      expect(states.at(-1)).toBe('lost');
      expect(roaster.count('safeStop')).toBe(1);
      expect(roaster.count('connect')).toBeGreaterThan(2);

      roaster.plugged = true;
      await clock.runFor(2000);
      expect(roaster.count('safeStop')).toBe(2);
      expect(states.at(-1)).toBe('connected');
      expect(session.acknowledgeSafety()).toEqual(ok(undefined));
    });

    it('still trips when a read hangs forever', async () => {
      const { clock, roaster, session, tripped } = setup();
      await session.connect(roaster, TARGET);
      await clock.runFor(1000);
      roaster.hangReads = true;
      await clock.runFor(5000);
      expect(tripped()).toEqual(['lost-connection']);
    });
  });

  it('locks the heater on emergency stop until acknowledged', async () => {
    const { roaster, session, tripped } = setup();
    await session.connect(roaster, TARGET);
    session.emergencyStop();
    expect(tripped()).toEqual(['emergency-stop']);
    expect(roaster.count('safeStop')).toBe(1);
    expect(await session.setOutput('heater', 40)).toEqual(
      err({ kind: 'safety-locked', channel: 'heater' }),
    );
    expect(session.acknowledgeSafety()).toEqual(ok(undefined));
    expect((await session.setOutput('heater', 40)).ok).toBe(true);
  });

  it('keeps the heater lock across a reconnect to another roaster', async () => {
    const { clock, roaster, session } = setup();
    await session.connect(roaster, TARGET);
    session.emergencyStop();
    await session.connect(new FakeRoaster(clock), TARGET);
    expect(await session.setOutput('heater', 40)).toEqual(
      err({ kind: 'safety-locked', channel: 'heater' }),
    );
  });

  it('stops polling the old roaster when connecting to a new one', async () => {
    const { clock, roaster, session } = setup();
    await session.connect(roaster, TARGET);
    await clock.runFor(2000);
    const second = new FakeRoaster(clock);
    await session.connect(second, TARGET);
    const oldReads = roaster.count('read');
    await clock.runFor(5000);
    expect(roaster.count('read')).toBe(oldReads);
    expect(second.count('read')).toBeGreaterThan(4);
    expect(roaster.log).toContain('safeStop');
  });

  it('closes the first roaster when a second connect comes before the first is done', async () => {
    const { clock, roaster, session } = setup();
    const second = new FakeRoaster(clock);
    await Promise.all([session.connect(roaster, TARGET), session.connect(second, TARGET)]);
    expect(roaster.log).toContain('disconnect');
    await clock.runFor(3000);
    expect(roaster.count('read')).toBe(0);
    expect(second.count('read')).toBeGreaterThan(1);
    expect(session.connection.status).toBe('connected');
  });
});

describe('RoasterSession error handling and logging', () => {
  function logged(overrides: Partial<ConstructorParameters<typeof RoasterSession>[0]> = {}) {
    const clock = new ManualClock();
    const roaster = new FakeRoaster(clock);
    const entries: LogEntry[] = [];
    const session = new RoasterSession({
      clock,
      onReading: () => undefined,
      onConnection: () => undefined,
      onSafetyEvent: () => undefined,
      logger: createLogger({ write: (e) => entries.push(e) }, 'session'),
      ...overrides,
    });
    const events = () => entries.map((e) => `${e.level}:${e.event}`);
    return { clock, roaster, session, entries, events };
  }

  it('logs a failed connect with the error', async () => {
    const { roaster, session, entries } = logged();
    roaster.plugged = false;
    await session.connect(roaster, TARGET);
    expect(entries.at(-1)).toMatchObject({
      level: 'warn',
      event: 'session.connect-failed',
      context: { error: { kind: 'disconnected' } },
    });
  });

  it('logs a lost connection once, not every second, and the recovery', async () => {
    const { clock, roaster, session, events } = logged();
    await session.connect(roaster, TARGET);
    roaster.unplug();
    await clock.runFor(30_000);
    roaster.plugged = true;
    await clock.runFor(2_000);
    expect(events().filter((e) => e.includes('read-'))).toEqual([
      'warn:session.read-failed',
      'info:session.read-recovered',
    ]);
    expect(events()).toContain('error:safety.tripped');
    expect(events()).toContain('info:safety.cleared');
  });

  it('logs a crashed poll loop, and lost connection still safe-stops', async () => {
    const { clock, roaster, session, events } = logged();
    await session.connect(roaster, TARGET);
    roaster.read = () => Promise.reject(new Error('driver bug'));
    await clock.runFor(5_000);
    expect(events()).toContain('error:session.poll-loop-crashed');
    expect(events()).toContain('error:safety.tripped');
    expect(roaster.count('safeStop')).toBe(1);
  });

  it('fails safe when a safety rule throws: logged, safe stop, heater locked', async () => {
    const limits = {
      ...DEFAULT_SAFETY_LIMITS,
      get maxTempC(): number {
        throw new Error('rule bug');
      },
    };
    const { clock, roaster, session, events } = logged({ limits });
    expect((await session.connect(roaster, TARGET)).ok).toBe(true);
    await clock.runFor(2_000);
    expect(events()).toContain('error:safety.rule-failed');
    expect(events()).toContain('error:safety.tripped');
    expect(roaster.count('safeStop')).toBe(1);
    expect(await session.setOutput('heater', 50)).toEqual(
      err({ kind: 'safety-locked', channel: 'heater' }),
    );
  });

  it('keeps polling and protecting when a listener throws', async () => {
    const { clock, roaster, session, events } = logged({
      onReading: () => {
        throw new Error('window gone');
      },
    });
    await session.connect(roaster, TARGET);
    await clock.runFor(3_000);
    expect(events()).toContain('error:session.listener-failed');
    expect(roaster.count('read')).toBeGreaterThanOrEqual(3);
  });

  it('logs refused outputs and acknowledgements', async () => {
    const { roaster, session, events } = logged();
    await session.connect(roaster, TARGET);
    roaster.bt = 250;
    session.emergencyStop();
    await session.setOutput('heater', 40);
    expect(events()).toContain('warn:session.set-output-failed');
  });
});

describe('RoasterSession state for a window that opens mid-roast', () => {
  it('remembers the latest connection state', async () => {
    const { roaster, session } = setup();
    expect(session.connection).toEqual({ status: 'disconnected' });
    await session.connect(roaster, TARGET);
    expect(session.connection).toEqual({ status: 'connected', target: TARGET, channels: CHANNELS });
  });

  it('reports the safety lock and tripped rules', async () => {
    const { roaster, session } = setup();
    await session.connect(roaster, TARGET);
    session.emergencyStop();
    expect(session.safetyStatus).toEqual({ locked: true, tripped: [] });
  });

  it('arms max roast time on roastStarted and stands it down on roastEnded', async () => {
    const { clock, roaster, session, tripped } = setup();
    await session.connect(roaster, TARGET);
    session.roastStarted();
    await clock.runFor(19 * 60_000);
    session.roastEnded();
    await clock.runFor(5 * 60_000);
    expect(tripped()).toEqual([]);
    session.roastStarted();
    await clock.runFor(20 * 60_000 + 1000);
    expect(tripped()).toEqual(['max-roast-time']);
  });
});
