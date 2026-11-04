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
import { silentLogger, type Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';
import type { RoasterDriver } from '../roaster-driver';
import { SafetyGuardedDriver } from '../safety/safety-guarded-driver';
import type { SafetyLimits } from '../safety/safety-limits';
import { SafetyMonitor } from '../safety/safety-monitor';
import { lostConnectionRule } from '../safety/rules/lost-connection';

export const POLL_MS = 1_000;
/** How long quit and disconnect wait for the safe stop before going on (docs/spec/architecture.md). */
export const SAFE_STOP_TIMEOUT_MS = 2_000;

export interface RoasterSessionOptions {
  clock: Clock;
  onReading: (reading: Reading) => void;
  onConnection: (state: ConnectionState) => void;
  onSafetyEvent: (event: SafetyEvent) => void;
  limits?: SafetyLimits;
  logger?: Logger;
}

/**
 * The connected roaster for the whole app: polls READ, runs the safety check on its own loop,
 * reconnects after a lost connection and publishes what happens (docs/spec/architecture.md).
 * One session lives as long as the app, so the heater lock survives a reconnect.
 */
export class RoasterSession {
  readonly #clock: Clock;
  /** The caller's listeners, guarded so a throwing listener can't break polling or safety. */
  #connection: ConnectionState = { status: 'disconnected' };
  readonly #publish: Pick<RoasterSessionOptions, 'onReading' | 'onConnection' | 'onSafetyEvent'>;
  readonly #monitor: SafetyMonitor;
  readonly #logger: Logger;
  readonly #reads: FailureStreak;
  #inner: RoasterDriver | undefined;
  /** What the current roaster is, for the connection state; set with the driver. */
  #target: ConnectTarget | undefined;
  #driver: SafetyGuardedDriver | undefined;
  /** Bumped on every connect and disconnect, so loops from an older connection stop. */
  #generation = 0;

  constructor(options: RoasterSessionOptions) {
    this.#clock = options.clock;
    this.#logger = options.logger ?? silentLogger;
    this.#publish = {
      onReading: this.#guard('onReading', options.onReading),
      onConnection: this.#guard('onConnection', (state: ConnectionState) => {
        this.#connection = state;
        options.onConnection(state);
      }),
      onSafetyEvent: this.#guard('onSafetyEvent', options.onSafetyEvent),
    };
    this.#reads = new FailureStreak(this.#logger, 'session.read');
    this.#monitor = new SafetyMonitor({
      clock: options.clock,
      safeStop: () => this.#inner?.safeStop() ?? Promise.resolve(),
      onEvent: (event) => {
        this.#logSafetyEvent(event);
        this.#publish.onSafetyEvent(event);
        this.#followLostConnection(event);
      },
      limits: options.limits,
      logger: this.#logger.child('monitor'),
    });
  }

  /** Disconnects any current roaster, then connects to this one (`target` names it) and starts polling. */
  async connect(driver: RoasterDriver, target: ConnectTarget): Promise<Result<void, DriverError>> {
    await this.disconnect();
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

  /** Safe stop, then close. Does nothing when not connected. */
  async disconnect(): Promise<void> {
    const driver = this.#driver;
    if (!driver) return;
    this.#generation++;
    await this.#safeStopWithin(driver);
    // Forget the driver first, so the lost-connection clear this causes isn't reported as "connected".
    this.#inner = undefined;
    this.#driver = undefined;
    this.#target = undefined;
    await driver.disconnect();
    this.#logger.info('session.disconnected');
    this.#publish.onConnection({ status: 'disconnected' });
  }

  async setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
    const result = (await this.#driver?.setOutput(channel, value)) ?? err({ kind: 'disconnected' });
    if (!result.ok)
      this.#logger.warn('session.set-output-failed', { channel, value, error: result.error });
    return result;
  }

  /** Safe stop and heater lock, connected or not. */
  emergencyStop(): void {
    this.#logger.warn('session.emergency-stop');
    this.#monitor.emergencyStop();
  }

  /** The latest connection state, for a window that opens mid-roast. */
  get connection(): ConnectionState {
    return this.#connection;
  }

  get safetyStatus(): { locked: boolean; tripped: string[] } {
    return { locked: this.#monitor.locked, tripped: [...this.#monitor.tripped] };
  }

  /** Charge: arms the max-roast-time rule. */
  roastStarted(): void {
    this.#monitor.roastStarted();
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

  async #pollLoop(generation: number): Promise<void> {
    while (generation === this.#generation && this.#driver) {
      const driver = this.#driver;
      const reading = await driver.read();
      if (generation !== this.#generation) return;
      this.#reads.record(reading);
      if (reading.ok) {
        this.#publish.onReading(reading.value);
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

  async #safeStopWithin(driver: RoasterDriver): Promise<void> {
    await Promise.race([driver.safeStop(), this.#clock.delay(SAFE_STOP_TIMEOUT_MS)]);
  }

  #guard<T>(name: string, listener: (payload: T) => void): (payload: T) => void {
    return (payload) => {
      try {
        listener(payload);
      } catch (error) {
        this.#logger.error('session.listener-failed', {
          listener: name,
          error: serializeError(error),
        });
      }
    };
  }

  #logSafetyEvent(event: SafetyEvent): void {
    if (event.kind === 'tripped') {
      const context = { rule: event.rule, action: event.action };
      if (event.action === 'safe-stop') this.#logger.error('safety.tripped', context);
      else this.#logger.warn('safety.tripped', context);
    } else if (event.kind === 'cleared') {
      this.#logger.info('safety.cleared', { rule: event.rule });
    } else {
      this.#logger.info('safety.unlocked');
    }
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
