import {
  err,
  ok,
  type AutoChargeSoonError,
  type AutoResumeError,
  type AutoStatus,
  type AutoStopReason,
  type Reading,
  type Result,
} from '@roastpilot/shared';
import { guardListener } from '../logging/guard-listener';
import { silentLogger, type Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';
import { AutoDrive } from './auto-drive';
import { AutoOutputs, isDriven } from './auto-outputs';
import type { AutoPilotDeps } from './auto-pilot-deps';
import { HeaterCut } from './heater-cut';
import type { AutoEvent } from './roast-run';
import { TickGate } from './tick-gate';

export type { AutoPilotDeps } from './auto-pilot-deps';

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
  readonly #drive: AutoDrive;
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
    this.#drive = new AutoDrive({
      deps,
      outputs: this.#outputs,
      heaterCut: this.#heaterCut,
      logger: this.#logger,
      event: this.#event,
      stopped: () => this.#stopReason !== null,
      stop: (reason) => {
        this.stop(reason);
      },
      roastOver: () => {
        this.#stopReason = null;
        this.#outputs.handBack();
      },
    });
  }

  get status(): AutoStatus {
    return {
      enabled: this.#enabled,
      profileId: this.#deps.profile().id,
      stopReason: this.#stopReason,
      heater: this.#outputs.owner('heater'),
      fan: this.#outputs.owner('fan'),
      preheatStep: this.#drive.preheat?.step ?? null,
      preheatLeftS: this.#drive.preheat?.leftS ?? null,
      phaseName: this.#drive.run?.phaseName ?? null,
      nextPhaseAtC: this.#drive.run?.nextPhaseAtC ?? null,
      stallTripped: this.#drive.run?.stallTripped ?? false,
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
    this.#drive.run?.restartControl();
    this.#logger.info('auto.resumed');
    this.#publish();
    return ok(undefined);
  }

  /** Heater 0 at once, and the countdown before the beans go in. */
  chargeSoon(nowMs: number): Result<void, AutoChargeSoonError> {
    if (!this.#enabled || this.#stopReason !== null || !this.#drive.preheat?.chargeSoon(nowMs)) {
      return err({ kind: 'not-now' });
    }
    this.#logger.info('auto.charge-soon');
    // Not on the next reading: the beans may land in the next second.
    if (this.#outputs.owner('heater') === 'auto') {
      this.#drive.cutHeater('charge-soon').catch((error: unknown) => {
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
        await this.#tick(reading);
        // After the tick, which forgets a cut once a new preheat or roast sets the heater itself.
        await this.#heaterCut.retry();
      } catch (error) {
        this.#logger.error('auto.tick-failed', { error: serializeError(error) });
        if (this.#outputs.owner('heater') === 'auto') await this.#drive.cutHeater('tick-failed');
        this.stop('tick-failed');
      }
    });
  }

  #isDriving(): boolean {
    const { phase } = this.#deps.roast();
    return phase === 'preheat' || phase === 'roasting' || phase === 'development';
  }

  async #tick(reading: Reading): Promise<void> {
    if (!this.#enabled) {
      this.#drive.reset();
      this.#publish();
      return;
    }
    const state = this.#deps.roast();
    this.#drive.sync(state, reading.atMs);
    if (this.#deps.heaterLocked()) this.stop('heater-locked');
    await this.#drive.drive(state, reading);
    this.#publish();
  }

  #publish(): void {
    const status = this.status;
    const json = JSON.stringify(status);
    if (json === this.#lastStatus) return;
    this.#lastStatus = json;
    this.#notify(status);
  }
}
