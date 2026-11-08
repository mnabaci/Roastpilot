import type { AutoProfile, AutoTuning, Reading } from '@roastpilot/shared';
import {
  startRoastRun,
  type RoastRun,
  type RoastTick,
  type RoastTickInput,
} from '../auto/roast-run';
import { BEAN_TEMP } from '../safety/safety-rule';
import type { PhaseSeen } from './coach-input';

/**
 * Auto for the chosen profile, run beside one manual roast (ADR 0019): caught up from charge,
 * started again from the heater that is set, and where its phase began as the coach saw it.
 */
export class CoachRun {
  readonly run: RoastRun;
  readonly profile: AutoProfile;
  #phaseSeen: PhaseSeen;
  #lastReportedHeater: number | undefined;

  /** Caught up to `reading` from the readings before it, starting from `heaterPct`. */
  constructor({
    profile,
    tuning,
    chargedAtMs,
    readings,
    reading,
    heaterPct,
  }: {
    profile: AutoProfile;
    tuning: AutoTuning;
    chargedAtMs: number;
    /** Every reading kept, `reading` included. */
    readings: readonly Reading[];
    reading: Reading;
    heaterPct: number | undefined;
  }) {
    const earlier = readings.filter((r) => r.atMs < reading.atMs);
    this.run = startRoastRun(profile, tuning, chargedAtMs, earlier);
    this.run.restartControl(heaterPct);
    this.profile = profile;
    // The phase it caught up into began before the coach was watching.
    const startMs = chargedAtMs + this.run.phaseStartedS * 1_000;
    const began = readings.find((r) => r.atMs >= startMs);
    this.#phaseSeen = {
      index: this.run.phaseIndex,
      atMs: undefined,
      btC: began?.values[BEAN_TEMP],
    };
    this.#lastReportedHeater = reading.values.heater;
  }

  get phaseSeen(): PhaseSeen {
    return this.#phaseSeen;
  }

  /** You set the heater: Auto's heat control starts again from your setting. */
  restartControl(heaterPct: number): void {
    this.run.restartControl(heaterPct);
  }

  /**
   * The heater changed without you (a safety rule, the roaster): start again from there too,
   * unless `yoursPending`, a setting of yours the roaster hasn't reported yet.
   */
  followReportedHeater(reading: Reading, yoursPending: boolean): void {
    const reported = reading.values.heater;
    const before = this.#lastReportedHeater;
    this.#lastReportedHeater = reported;
    if (reported === undefined || before === undefined || reported === before) return;
    if (!yoursPending) this.run.restartControl(reported);
  }

  /** Auto's tick for this reading; a phase that begins is seen beginning now. */
  tick(input: RoastTickInput): RoastTick {
    const tick = this.run.tick(input);
    if (tick.events.some((e) => e.kind === 'phase'))
      this.#phaseSeen = { index: this.run.phaseIndex, atMs: input.nowMs, btC: input.btC };
    return tick;
  }
}
