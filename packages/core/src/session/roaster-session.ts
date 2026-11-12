import {
  err,
  type AcknowledgeError,
  type ConnectionState,
  type DriverError,
  type Reading,
  type Result,
  type SafetyEvent,
  type ConnectTarget,
} from '@roastpilot/shared';
import type { Clock } from '../clock';
import { FailureStreak } from '../logging/failure-streak';
import { guardListener } from '../logging/guard-listener';
import { silentLogger, type Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';
import type { RoasterDriver } from '../roaster-driver';
import { SafetyGuardedDriver } from '../safety/safety-guarded-driver';
import type { SafetyLimits } from '../safety/safety-limits';
import { EMERGENCY_STOP, SafetyMonitor, type COMPUTER_SLEEP } from '../safety/safety-monitor';
import { lostConnectionRule } from '../safety/rules/lost-connection';
import { BEAN_TEMP } from '../safety/safety-rule';
import { logSafetyEvent } from '../safety/log-safety-event';

export const POLL_MS = 1_000;
/** How long quit and disconnect wait for the safe stop before going on (docs/spec/architecture.md). */
export const SAFE_STOP_TIMEOUT_MS = 2_000;
/** How long disconnect waits for the port to close, so an adapter that never answers can't hold up quit. */
export const CLOSE_TIMEOUT_MS = 2_000;

export interface RoasterSessionOptions {
  clock: Clock;
  onReading: (reading: Reading) => void;
  onConnection: (state: ConnectionState) => void;
  onSafetyEvent: (event: SafetyEvent) => void;
  /** Read on every check, so the active roaster's limits apply (docs/spec/roasters.md). */
  limits?: SafetyLimits | (() => SafetyLimits);
  /** Added to the temperature before anything else sees it, safety rules included. */
  tempOffsetC?: () => number;
  logger?: Logger;
}

/**
 * The connected roaster for the whole app: polls READ, runs the safety check on its own loop,
 * reconnects after a lost connection and publishes what happens (docs/spec/architecture.md).
 * One session lives as long as the app, so the heater lock survives a reconnect.
 */
export class RoasterSession {
  readonly #clock: Clock;
  #connection: ConnectionState = { status: 'disconnected' };
  readonly #publish: Pick<RoasterSessionOptions, 'onReading' | 'onConnection' | 'onSafetyEvent'>;
  readonly #monitor: SafetyMonitor;
  readonly #logger: Logger;
  readonly #tempOffsetC: () => number;
  readonly #reads: FailureStreak;
  #inner: RoasterDriver | undefined;
  /** What the current roaster is, for the connection state; set with the driver. */
  #target: ConnectTarget | undefined;
  #driver: SafetyGuardedDriver | undefined;
  /** Bumped on every connect and disconnect, so loops from an older connection stop. */
  #generation = 0;
  /** Output commands sent but not settled yet: the disconnect's safe stop goes after them. */
  readonly #outputsInFlight = new Set<Promise<unknown>>();
  /** The disconnect under way, so a second disconnect or a connect waits for it. */
  #disconnecting: Promise<void> | undefined;

  constructor(options: RoasterSessionOptions) {
    this.#clock = options.clock;
    this.#logger = options.logger ?? silentLogger;
    this.#tempOffsetC = options.tempOffsetC ?? (() => 0);
    // The caller's listeners, guarded so a throwing listener can't break polling or safety.
    const guard = <T>(listener: string, fn: (payload: T) => void) =>
      guardListener(this.#logger, 'session.listener-failed', fn, { listener });
    this.#publish = {
      onReading: guard('onReading', options.onReading),
      onConnection: guard('onConnection', (state: ConnectionState) => {
        this.#connection = state;
        options.onConnection(state);
      }),
      onSafetyEvent: guard('onSafetyEvent', options.onSafetyEvent),
    };
    this.#reads = new FailureStreak(this.#logger, 'session.read');
    this.#monitor = new SafetyMonitor({
      clock: options.clock,
      safeStop: () => this.#inner?.safeStop() ?? Promise.resolve(),
      onEvent: (event) => {
        logSafetyEvent(this.#logger, event);
        this.#publish.onSafetyEvent(event);
        this.#followLostConnection(event);
      },
      limits: options.limits,
      logger: this.#logger.child('monitor'),
    });
  }

  /** Disconnects any current roaster, then connects to this one (`target` names it) and starts polling. */
  async connect(driver: RoasterDriver, target: ConnectTarget): Promise<Result<void, DriverError>> {
    // A connect that came in while this one waited has set its driver: close that one too, or its
    // port stays open with nothing polling or safe-stopping it.
    while (this.#driver || this.#disconnecting) await this.disconnect();
    const generation = ++this.#generation;
    this.#inner = driver;
    this.#driver = new SafetyGuardedDriver(driver, this.#monitor);
    this.#target = target;
    this.#publish.onConnection({ status: 'connecting', target });
    this.#logger.info('session.connecting');

    const connected = await this.#driver.connect();
    if (generation !== this.#generation) return connected;
    if (!connected.ok) {
      this.#logger.warn('session.connect-failed', { error: connected.error });
      this.#inner = undefined;
      this.#driver = undefined;
      this.#target = undefined;
      this.#publish.onConnection({ status: 'disconnected' });
      return connected;
    }
    this.#logger.info('session.connected', { channels: driver.channels.map((c) => c.id) });
    this.#publish.onConnection({ status: 'connected', target, channels: [...driver.channels] });
    this.#pollLoop(generation).catch((error: unknown) => {
      // No more readings: the safety loop's lost-connection rule safe-stops within 3 s.
      this.#logger.error('session.poll-loop-crashed', { error: serializeError(error) });
    });
    this.#safetyLoop(generation).catch((error: unknown) => {
      this.#logger.error('session.safety-loop-crashed', { error: serializeError(error) });
      this.emergencyStop();
    });
    return connected;
  }

  /**
   * Safe stop, then close, each given a time limit. Does nothing when not connected; a second call
   * waits for the first. Outputs are refused from the moment it starts, so the safe stop is last.
   */
  disconnect(): Promise<void> {
    if (this.#disconnecting) return this.#disconnecting;
    const driver = this.#driver;
    if (!driver) return Promise.resolve();
    this.#generation++;
    // Forget the driver first: setOutput refuses from now on, and the lost-connection clear this
    // causes isn't reported as "connected". `#inner` stays until closed, so an emergency stop
    // meanwhile still reaches the roaster.
    this.#driver = undefined;
    this.#target = undefined;
    this.#disconnecting = this.#stopAndClose(driver).finally(() => {
      this.#inner = undefined;
      this.#disconnecting = undefined;
    });
    return this.#disconnecting;
  }

  async setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
    const driver = this.#driver;
    const result = driver
      ? await this.#send(driver, channel, value)
      : err({ kind: 'disconnected' as const });
    if (!result.ok)
      this.#logger.warn('session.set-output-failed', { channel, value, error: result.error });
    return result;
  }

  /** Safe stop and heater lock, connected or not; `rule` says why when it isn't the red button. */
  emergencyStop(rule: typeof EMERGENCY_STOP | typeof COMPUTER_SLEEP = EMERGENCY_STOP): void {
    this.#logger.warn('session.emergency-stop', { rule });
    this.#monitor.emergencyStop(rule);
  }

  /** The latest connection state, for a window that opens mid-roast. */
  get connection(): ConnectionState {
    return this.#connection;
  }

  get safetyStatus(): { locked: boolean; tripped: string[] } {
    return { locked: this.#monitor.locked, tripped: [...this.#monitor.tripped] };
  }

  /** Charge: arms the max-roast-time rule. */
  roastStarted(atMs?: number): void {
    this.#monitor.roastStarted(atMs);
  }

  /** The turning point: the stall alarm watches from here. */
  turningPoint(atMs?: number): void {
    this.#monitor.turningPoint(atMs);
  }

  /** Drop: the max-roast-time rule stands down. */
  roastEnded(): void {
    this.#monitor.roastEnded();
  }

  acknowledgeSafety(): Result<void, AcknowledgeError> {
    const result = this.#monitor.acknowledge();
    if (!result.ok) this.#logger.info('safety.acknowledge-refused', { rules: result.error.rules });
    return result;
  }

  #withOffset(reading: Reading): Reading {
    const offset = this.#tempOffsetC();
    const bt = reading.values[BEAN_TEMP];
    if (offset === 0 || bt === undefined) return reading;
    return { ...reading, values: { ...reading.values, [BEAN_TEMP]: bt + offset } };
  }

  async #pollLoop(generation: number): Promise<void> {
    while (generation === this.#generation && this.#driver) {
      const driver = this.#driver;
      const reading = await driver.read();
      if (generation !== this.#generation) return;
      this.#reads.record(reading);
      if (reading.ok) {
        this.#publish.onReading(this.#withOffset(reading.value));
      } else if (reading.error.kind === 'disconnected') {
        // The port is gone: keep trying. The first reading back sends the second safe stop.
        await driver.connect();
      }
      await this.#clock.delay(POLL_MS);
    }
  }

  /** Runs the safety check even if a read hangs, so lost connection always trips. */
  async #safetyLoop(generation: number): Promise<void> {
    while (generation === this.#generation) {
      await this.#clock.delay(POLL_MS);
      if (generation !== this.#generation) return;
      this.#monitor.check();
    }
  }

  async #send(
    driver: RoasterDriver,
    channel: string,
    value: number,
  ): Promise<Result<void, DriverError>> {
    const sending = driver.setOutput(channel, value);
    this.#outputsInFlight.add(sending);
    try {
      return await sending;
    } finally {
      this.#outputsInFlight.delete(sending);
    }
  }

  async #stopAndClose(driver: RoasterDriver): Promise<void> {
    // An output sent before the disconnect could otherwise reach the roaster after the safe stop.
    const outputs = Promise.allSettled([...this.#outputsInFlight]);
    if (!(await this.#within(outputs, SAFE_STOP_TIMEOUT_MS)))
      this.#logger.warn('session.outputs-timed-out', { timeoutMs: SAFE_STOP_TIMEOUT_MS });
    if (!(await this.#within(driver.safeStop(), SAFE_STOP_TIMEOUT_MS)))
      this.#logger.warn('session.safe-stop-timed-out', { timeoutMs: SAFE_STOP_TIMEOUT_MS });
    if (!(await this.#within(driver.disconnect(), CLOSE_TIMEOUT_MS)))
      this.#logger.error('session.close-timed-out', { timeoutMs: CLOSE_TIMEOUT_MS });
    this.#logger.info('session.disconnected');
    this.#publish.onConnection({ status: 'disconnected' });
  }

  /** Waits for `work`, but no longer than `ms` of clock time: true when it finished in time. */
  async #within(work: Promise<unknown>, ms: number): Promise<boolean> {
    const timedOut = this.#clock.delay(ms).then(() => false);
    return Promise.race([work.then(() => true), timedOut]);
  }

  #followLostConnection(event: SafetyEvent): void {
    if (event.kind === 'unlocked' || event.rule !== lostConnectionRule.id || !this.#driver) return;
    const target = this.#target;
    if (!target) return;
    if (event.kind === 'tripped') this.#publish.onConnection({ status: 'lost', target });
    else {
      this.#publish.onConnection({
        status: 'connected',
        target,
        channels: [...this.#driver.channels],
      });
    }
  }
}
