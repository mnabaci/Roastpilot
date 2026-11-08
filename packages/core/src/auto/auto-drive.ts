import type { AutoStopReason, Reading, RoastState } from '@roastpilot/shared';
import type { Logger } from '../logging/logger';
import { rateOfRise, rorReadings } from '../roast/rate-of-rise';
import { BEAN_TEMP } from '../safety/safety-rule';
import type { AutoOutputs } from './auto-outputs';
import type { AutoPilotDeps } from './auto-pilot-deps';
import type { HeaterCut } from './heater-cut';
import { PreheatProtocol } from './preheat-protocol';
import { startRoastRun, type AutoEvent, type RoastRun } from './roast-run';

/** What AutoDrive needs from AutoPilot, which owns the outputs, the stop and the events. */
export interface AutoDriveHost {
  deps: AutoPilotDeps;
  outputs: AutoOutputs;
  heaterCut: HeaterCut;
  logger: Logger;
  event: (event: AutoEvent) => void;
  stopped: () => boolean;
  stop: (reason: AutoStopReason) => void;
  /** The roast is over: a stop or an override doesn't carry into the next one. */
  roastOver: () => void;
  /** Your preheat hold for this roast, if you chose one. */
  chosenHoldS: () => number | null;
  /** The preheat is over: a chosen hold was for it only. */
  preheatOver: () => void;
}

/**
 * What Auto does with each reading: follows the flow into a preheat or a roast and drives heater
 * and fan for it, until Drop (docs/spec/roast-control.md, Roast phases end to end).
 */
export class AutoDrive {
  readonly #host: AutoDriveHost;
  #preheat: PreheatProtocol | undefined;
  #run: RoastRun | undefined;
  #dropping = false;

  constructor(host: AutoDriveHost) {
    this.#host = host;
  }

  get preheat(): PreheatProtocol | undefined {
    return this.#preheat;
  }

  get run(): RoastRun | undefined {
    return this.#run;
  }

  /** Auto off: it keeps nothing, so a manual roast records nothing from here. */
  reset(): void {
    this.#preheat = undefined;
    this.#run = undefined;
    this.#dropping = false;
  }

  /** Follows the flow: a new preheat or roast starts fresh, and nothing runs outside them. */
  sync(state: RoastState, nowMs: number): void {
    const { deps, heaterCut } = this.#host;
    if (state.phase === 'preheat') {
      this.#run = undefined;
      if (!this.#preheat) {
        const hold = deps.preheatHold();
        const chosenS = this.#host.chosenHoldS();
        this.#preheat = new PreheatProtocol(deps.profile(), deps.tuning(), hold, chosenS);
        this.#host.logger.info('auto.preheat-hold', { ...this.#preheat.hold });
        // A new preheat sets the heater itself: an old cut must not land over it.
        heaterCut.forget();
      }
      return;
    }
    if (this.#preheat) this.#host.preheatOver();
    this.#preheat = undefined;
    if (state.phase !== 'roasting' && state.phase !== 'development') {
      this.#run = undefined;
      this.#dropping = false;
      this.#host.roastOver();
      return;
    }
    const chargedAtMs = state.chargedAtMs;
    if (chargedAtMs !== null && this.#run?.chargedAtMs !== chargedAtMs) {
      const profile = deps.profile();
      // The newest reading is left for the tick that follows.
      const earlier = deps.readings().filter((r) => r.atMs < nowMs);
      this.#run = startRoastRun(profile, deps.tuning(), chargedAtMs, earlier);
      heaterCut.forget();
      this.#host.event({ kind: 'phase', name: this.#run.phaseName ?? '' });
    }
  }

  /** Sends what the preheat or the roast asks for now; nothing after a stop. */
  async drive(state: RoastState, reading: Reading): Promise<void> {
    if (this.#host.stopped()) return;
    const btC = reading.values[BEAN_TEMP];
    if (state.phase === 'preheat') await this.#drivePreheat(reading.atMs, btC);
    else if (this.#run) await this.#driveRoast(this.#run, state, reading, btC);
  }

  /** Heater 0 that keeps trying until it lands; what Auto sent before no longer counts. */
  cutHeater(reason: string): Promise<void> {
    this.#host.outputs.forgetSent();
    return this.#host.heaterCut.cut(reason);
  }

  async #drivePreheat(nowMs: number, btC: number | undefined): Promise<void> {
    if (!this.#preheat) return;
    const { outputs } = this.#host;
    const next = this.#preheat.next(nowMs, btC);
    await outputs.send('fan', next.fanPct);
    if (next.gaveUp) {
      if (outputs.owner('heater') === 'auto') await this.cutHeater('preheat-limit');
      this.#host.stop('preheat-limit');
      return;
    }
    await outputs.send('heater', next.heaterPct);
  }

  async #driveRoast(
    run: RoastRun,
    state: RoastState,
    reading: Reading,
    btC: number | undefined,
  ): Promise<void> {
    const { deps, outputs, logger } = this.#host;
    const tick = run.tick({
      nowMs: reading.atMs,
      btC,
      ror: rateOfRise(rorReadings(deps.readings(), state.chargedAtMs)),
      firstCrackAtMs: state.firstCrackAtMs,
    });
    tick.events.forEach((event) => {
      logger.info('auto.event', { ...event });
      this.#host.event(event);
    });
    if (tick.endRule && !this.#dropping) {
      this.#dropping = true;
      logger.info('auto.drop', { rule: tick.endRule.id, bt: btC });
      try {
        await deps.drop();
      } catch (error) {
        // Refused: after Resume auto the end rule must drop again, not heat on past it.
        this.#dropping = false;
        throw error;
      }
      // Drop sends heater 0 itself; this one keeps trying through cooling if that write failed.
      await this.cutHeater('drop');
      return;
    }
    await outputs.send('heater', tick.heaterPct);
    await outputs.send('fan', tick.fanPct);
  }
}
