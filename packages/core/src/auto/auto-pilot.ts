import {
  err,
  ok,
  type AutoChargeSoonError,
  type AutoProfile,
  type AutoResumeError,
  type AutoStatus,
  type AutoStopReason,
  type AutoTuning,
  type DriverError,
  type Reading,
  type Result,
  type RoastState,
} from '@roastpilot/shared';
import { guardListener } from '../logging/guard-listener';
import { silentLogger, type Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';
import { rateOfRise, rorReadings } from '../roast/rate-of-rise';
import { BEAN_TEMP } from '../safety/safety-rule';
import { AutoOutputs, isDriven } from './auto-outputs';
import { HeaterCut } from './heater-cut';
import { withSoakTime } from './phase-plan';
import { PreheatProtocol } from './preheat-protocol';
import { startRoastRun, type AutoEvent, type RoastRun } from './roast-run';
import { TickGate } from './tick-gate';

/** What AutoPilot needs from the app (docs/spec/roast-control.md, Auto mode). */
export interface AutoPilotDeps {
  roast: () => RoastState;
  readings: () => readonly Reading[];
  /** The guarded driver's path, so every command passes the safety rules. */
  setOutput: (channel: string, value: number) => Promise<Result<void, DriverError>>;
  /** Clamps and rounds to what the connected roaster takes. */
  round: (channel: string, value: number) => number;
  heaterLocked: () => boolean;
  /** Asks the flow to Drop, so cooling and saving stay in one place. Throws if it can't. */
  drop: () => Promise<void>;
  profile: () => AutoProfile;
  tuning: () => AutoTuning;
  soakS: () => number;
  onEvent: (event: AutoEvent) => void;
  onChange: (status: AutoStatus) => void;
  logger?: Logger;
}

/**
 * Drives heater and fan beside the roast flow, from Preheat until Drop. It never turns the heater
 * back on by itself after a stop (docs/spec/safety.md, Auto mode).
 */
export class AutoPilot {
  readonly #deps: AutoPilotDeps;
  readonly #logger: Logger;
  readonly #notify: (status: AutoStatus) => void;
  readonly #event: (event: AutoEvent) => void;
  #enabled = false;
  #stopReason: AutoStopReason | null = null;
  readonly #outputs: AutoOutputs;
  readonly #heaterCut: HeaterCut;
  #preheat: PreheatProtocol | undefined;
  #run: RoastRun | undefined;
  #dropping = false;
  readonly #gate: TickGate;
  #lastStatus = '';

  constructor(deps: AutoPilotDeps) {
    this.#deps = deps;
    this.#logger = deps.logger ?? silentLogger;
    this.#outputs = new AutoOutputs(deps.setOutput, deps.round, this.#logger);
    this.#heaterCut = new HeaterCut(deps.setOutput, this.#logger);
    this.#gate = new TickGate(this.#logger);
    this.#notify = guardListener(this.#logger, 'auto.listener-failed', deps.onChange);
    this.#event = guardListener(this.#logger, 'auto.listener-failed', deps.onEvent);
  }

  get status(): AutoStatus {
    return {
      enabled: this.#enabled,
      profileId: this.#deps.profile().id,
      stopReason: this.#stopReason,
      heater: this.#outputs.owner('heater'),
      fan: this.#outputs.owner('fan'),
      preheatStep: this.#preheat?.step ?? null,
      preheatLeftS: this.#preheat?.leftS ?? null,
      phaseName: this.#run?.phaseName ?? null,
      nextPhaseAtC: this.#run?.nextPhaseAtC ?? null,
      stallTripped: this.#run?.stallTripped ?? false,
    };
  }

  /** Auto or Manual, at any time. Outputs stay as they are until the next reading. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.#enabled) {
      this.#publish();
      return;
    }
    this.#enabled = enabled;
    this.#logger.info('auto.mode-changed', { enabled });
    this.#outputs.forgetSent();
    if (enabled) {
      this.#stopReason = null;
      this.#outputs.handBack();
    }
    // Mid-roast the switch goes on the roast's timeline, and an Auto roast is saved as one.
    if (this.#deps.roast().chargedAtMs !== null && this.#isDriving()) {
      this.#event({ kind: 'mode', auto: enabled });
    }
    this.#publish();
  }

  /** You set an output by hand: it stays yours until Resume auto. */
  outputRequested(channel: string, value: number): void {
    if (channel === 'heater') this.#heaterCut.forget();
    if (!this.#enabled || !isDriven(channel) || !this.#isDriving()) return;
    if (this.#outputs.owner(channel) === 'manual') return;
    this.#outputs.takeOver(channel);
    this.#logger.info('auto.override', { channel, value });
    this.#event({ kind: 'override', channel, value });
    this.#publish();
  }

  /** A safe stop or a lost connection: both outputs are yours, and nothing more is sent. */
  stop(reason: AutoStopReason): void {
    if (!this.#enabled || this.#stopReason !== null) return;
    this.#stopReason = reason;
    this.#outputs.takeOver('heater');
    this.#outputs.takeOver('fan');
    this.#logger.warn('auto.stopped', { reason });
    this.#publish();
  }

  /** Hands the outputs back to the current phase; refused while the heater is locked. */
  resume(): Result<void, AutoResumeError> {
    if (this.#deps.heaterLocked()) {
      this.#logger.info('auto.resume-refused', { reason: 'safety-locked' });
      return err({ kind: 'safety-locked' });
    }
    this.#stopReason = null;
    this.#outputs.handBack();
    this.#run?.restartControl();
    this.#logger.info('auto.resumed');
    this.#publish();
    return ok(undefined);
  }

  /** Heater 0 at once, and the countdown before the beans go in. */
  chargeSoon(nowMs: number): Result<void, AutoChargeSoonError> {
    if (!this.#enabled || this.#stopReason !== null || !this.#preheat?.chargeSoon(nowMs)) {
      return err({ kind: 'not-now' });
    }
    this.#logger.info('auto.charge-soon');
    // Not on the next reading: the beans may land in the next second.
    if (this.#outputs.owner('heater') === 'auto') {
      this.#outputs.forgetSent();
      this.#heaterCut.cut('charge-soon').catch((error: unknown) => {
        this.#logger.error('auto.heater-cut-failed', { error: serializeError(error) });
      });
    }
    this.#publish();
    return ok(undefined);
  }

  /** Every reading, one at a time (TickGate). */
  onReading(reading: Reading): Promise<void> {
    return this.#gate.run(reading.atMs, async () => {
      try {
        await this.#heaterCut.retry();
        await this.#tick(reading);
      } catch (error) {
        this.#logger.error('auto.tick-failed', { error: serializeError(error) });
        if (this.#outputs.owner('heater') === 'auto') await this.#heaterCut.cut('tick-failed');
        this.stop('tick-failed');
      }
    });
  }

  #isDriving(): boolean {
    const { phase } = this.#deps.roast();
    return phase === 'preheat' || phase === 'roasting' || phase === 'development';
  }

  async #tick(reading: Reading): Promise<void> {
    // Off, Auto keeps nothing: a manual roast records nothing from here.
    if (!this.#enabled) {
      this.#preheat = undefined;
      this.#run = undefined;
      this.#dropping = false;
      this.#publish();
      return;
    }
    const state = this.#deps.roast();
    this.#syncWithFlow(state, reading.atMs);
    if (this.#deps.heaterLocked()) this.stop('heater-locked');
    const btC = reading.values[BEAN_TEMP];
    if (state.phase === 'preheat') await this.#tickPreheat(reading.atMs, btC);
    else if (this.#run) await this.#tickRoast(state, reading, btC);
    this.#publish();
  }

  /** Follows the flow: a new preheat or roast starts fresh, and nothing runs outside them. */
  #syncWithFlow(state: RoastState, nowMs: number): void {
    if (state.phase === 'preheat') {
      this.#run = undefined;
      this.#preheat ??= new PreheatProtocol(this.#deps.profile(), this.#deps.tuning());
      return;
    }
    this.#preheat = undefined;
    if (state.phase !== 'roasting' && state.phase !== 'development') {
      this.#run = undefined;
      this.#dropping = false;
      // The roast is over: a stop or an override doesn't carry into the next one.
      this.#stopReason = null;
      this.#outputs.handBack();
      return;
    }
    const chargedAtMs = state.chargedAtMs;
    if (chargedAtMs !== null && this.#run?.chargedAtMs !== chargedAtMs) {
      const profile = withSoakTime(this.#deps.profile(), this.#deps.soakS());
      // The newest reading is left for the tick that follows.
      const earlier = this.#deps.readings().filter((r) => r.atMs < nowMs);
      this.#run = startRoastRun(profile, this.#deps.tuning(), chargedAtMs, earlier);
      this.#event({ kind: 'phase', name: this.#run.phaseName ?? '' });
    }
  }

  async #tickPreheat(nowMs: number, btC: number | undefined): Promise<void> {
    if (!this.#preheat || this.#stopReason !== null) return;
    const outputs = this.#preheat.next(nowMs, btC);
    await this.#outputs.send('fan', outputs.fanPct);
    if (outputs.gaveUp) {
      if (this.#outputs.owner('heater') === 'auto') await this.#heaterCut.cut('preheat-limit');
      this.stop('preheat-limit');
      return;
    }
    await this.#outputs.send('heater', outputs.heaterPct);
  }

  async #tickRoast(state: RoastState, reading: Reading, btC: number | undefined): Promise<void> {
    if (!this.#run || this.#stopReason !== null) return;
    const readings = rorReadings(this.#deps.readings(), state.chargedAtMs);
    const tick = this.#run.tick({
      nowMs: reading.atMs,
      btC,
      ror: rateOfRise(readings),
      firstCrackAtMs: state.firstCrackAtMs,
    });
    tick.events.forEach((event) => {
      this.#logger.info('auto.event', { ...event });
      this.#event(event);
    });
    if (tick.endRule && !this.#dropping) {
      this.#dropping = true;
      this.#logger.info('auto.drop', { rule: tick.endRule.id, bt: btC });
      await this.#deps.drop();
      // Drop sends heater 0 itself; this one keeps trying through cooling if that write failed.
      await this.#heaterCut.cut('drop');
      return;
    }
    await this.#outputs.send('heater', tick.heaterPct);
    await this.#outputs.send('fan', tick.fanPct);
  }

  #publish(): void {
    const status = this.status;
    const json = JSON.stringify(status);
    if (json === this.#lastStatus) return;
    this.#lastStatus = json;
    this.#notify(status);
  }
}
