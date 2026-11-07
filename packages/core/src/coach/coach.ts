import {
  err,
  ok,
  type AutoProfile,
  type CoachSetting,
  type CoachStatus,
  type Reading,
  type Result,
  type RoastState,
} from '@roastpilot/shared';
import { startRoastRun, type RoastRun } from '../auto/roast-run';
import { guardListener } from '../logging/guard-listener';
import { silentLogger, type Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';
import { rateOfRise, rorReadings } from '../roast/rate-of-rise';
import { BEAN_TEMP } from '../safety/safety-rule';
import { CoachCard } from './coach-card';
import type { CoachDeps } from './coach-deps';
import { coachInput, gapsOf, type PhaseSeen } from './coach-input';
import { rorTrend } from './ror-trend';
import { SetOutputs } from './set-outputs';

export type { CoachDeps } from './coach-deps';

/** Why the coach is quiet. */
type Quiet = 'not-roasting' | 'off' | 'heater-locked' | 'failed';

/** Apply refused by the coach itself: the card changed, or the roast no longer allows it. */
export type CoachClaimError = { kind: 'stale' } | { kind: 'not-now' };

/**
 * The manual coach (docs/spec/manual-mode.md, Coach; ADR 0019): runs Auto for the chosen profile
 * beside a manual roast, from charge to Drop, and turns what it would do into one card. It never
 * sends anything; main owns Apply.
 */
export class Coach {
  readonly #deps: CoachDeps;
  readonly #logger: Logger;
  readonly #notify: (status: CoachStatus) => void;
  readonly #card = new CoachCard();
  readonly #set = new SetOutputs();
  #run: RoastRun | undefined;
  #profile: AutoProfile | undefined;
  /** The roast the card's memory belongs to. */
  #chargedAtMs: number | null = null;
  #phaseSeen: PhaseSeen | undefined;
  #lastReportedHeater: number | undefined;
  #lastStatus = '';
  /** A tick failed and none has worked since: logged once when it starts and once when it ends. */
  #failing = false;

  constructor(deps: CoachDeps) {
    this.#deps = deps;
    this.#logger = deps.logger ?? silentLogger;
    this.#notify = guardListener(this.#logger, 'coach.listener-failed', deps.onChange);
  }

  get status(): CoachStatus {
    const advice = this.#card.shown;
    const profile = this.#profile;
    return {
      advice,
      needsCalibration: advice && profile?.needsCalibration ? profile.name : null,
    };
  }

  /** Every reading, after it is kept. */
  onReading(reading: Reading): void {
    try {
      this.#tick(reading);
      if (this.#failing) this.#logger.info('coach.tick-recovered');
      this.#failing = false;
    } catch (error) {
      if (!this.#failing) this.#logger.error('coach.tick-failed', { error: serializeError(error) });
      this.#failing = true;
      this.#stop('failed');
    }
    this.#publish();
  }

  /** The roast, mode, setting, connection or safety changed: a card that can't stay goes at once. */
  sync(): void {
    const quiet = this.#quiet(this.#deps.roast());
    if (quiet) this.#stop(quiet);
    this.#publish();
  }

  /** A safe stop: the card goes at once, before the lock that follows it is in place. */
  stop(): void {
    this.#stop('heater-locked');
    this.#publish();
  }

  /** You set an output (slider or Apply): Auto's heat control starts again from your heater. */
  outputRequested(channel: string, value: number): void {
    if (channel !== 'heater' && channel !== 'fan') return;
    this.#set.requested(channel, value, this.#deps.clock.now());
    if (channel === 'heater') this.#run?.restartControl(value);
  }

  /** Takes the setting suggestion `id` off the card for Apply, while the roast still allows it. */
  claim(id: number): Result<CoachSetting, CoachClaimError> {
    if (this.#quiet(this.#deps.roast())) return err({ kind: 'not-now' });
    const setting = this.#card.claim(id);
    this.#publish();
    return setting ? ok(setting) : err({ kind: 'stale' });
  }

  /** Hides card `id` (docs/spec/manual-mode.md, Coach: Dismiss); a card that changed stays. */
  dismiss(id: number): void {
    const dismissed = this.#card.dismiss(id);
    if (dismissed) this.#logger.info('coach.dismissed', { kind: dismissed.kind, id });
    this.#publish();
  }

  #quiet(roast: RoastState): Quiet | undefined {
    const roasting = roast.phase === 'roasting' || roast.phase === 'development';
    if (!roasting || roast.chargedAtMs === null) return 'not-roasting';
    if (!this.#deps.wanted()) return 'off';
    if (this.#deps.heaterLocked()) return 'heater-locked';
    return undefined;
  }

  #stop(reason: Quiet): void {
    if (this.#run) this.#logger.info('coach.stopped', { reason });
    this.#run = undefined;
    this.#card.clear();
  }

  #tick(reading: Reading): void {
    const roast = this.#deps.roast();
    const quiet = this.#quiet(roast);
    const chargedAtMs = roast.chargedAtMs;
    if (quiet || chargedAtMs === null) {
      this.#stop(quiet ?? 'not-roasting');
      return;
    }
    if (chargedAtMs !== this.#chargedAtMs) {
      this.#chargedAtMs = chargedAtMs;
      this.#run = undefined;
      this.#card.reset();
    }
    const run = this.#run ?? this.#start(chargedAtMs, reading);
    const profile = this.#profile ?? this.#deps.profile();
    this.#followReportedHeater(run, reading);
    const sinceCharge = rorReadings(this.#deps.readings(), chargedAtMs);
    const btC = reading.values[BEAN_TEMP];
    const ror = rateOfRise(sinceCharge);
    const tick = run.tick({ nowMs: reading.atMs, btC, ror, firstCrackAtMs: roast.firstCrackAtMs });
    if (tick.events.some((e) => e.kind === 'phase'))
      this.#phaseSeen = { index: run.phaseIndex, atMs: reading.atMs, btC };
    const { round } = this.#deps;
    const input = coachInput({
      run,
      profile,
      roast,
      reading,
      now: { btC, ror, trend: rorTrend(sinceCharge) },
      set: { heater: this.#set.value('heater', reading), fan: this.#set.value('fan', reading) },
      wants: { heater: round('heater', tick.heaterPct), fan: round('fan', tick.fanPct) },
      phaseSeen: this.#phaseSeen,
      expectedFirstCrackC: this.#deps.expectedFirstCrackC(),
    });
    const posted = this.#card.update({
      tips: this.#deps.rules.flatMap((rule) => rule.advise(input) ?? []),
      nowMs: reading.atMs,
      phaseIndex: run.phaseIndex,
      gaps: gapsOf(input),
      set: input.set,
    });
    if (posted) this.#logger.info('coach.suggested', { ...posted });
  }

  /** A run for this roast, caught up from charge and starting from your heater. */
  #start(chargedAtMs: number, reading: Reading): RoastRun {
    const profile = this.#deps.profile();
    const earlier = this.#deps.readings().filter((r) => r.atMs < reading.atMs);
    const run = startRoastRun(profile, this.#deps.tuning(), chargedAtMs, earlier);
    run.restartControl(this.#set.value('heater', reading));
    this.#run = run;
    this.#profile = profile;
    // The phase it caught up into began before the coach was watching.
    const startMs = chargedAtMs + run.phaseStartedS * 1_000;
    const began = this.#deps.readings().find((r) => r.atMs >= startMs);
    this.#phaseSeen = {
      index: run.phaseIndex,
      atMs: Number.NEGATIVE_INFINITY,
      btC: began?.values[BEAN_TEMP],
    };
    this.#lastReportedHeater = reading.values.heater;
    this.#logger.info('coach.started', { profileId: profile.id, phase: run.phaseName });
    return run;
  }

  /** The heater changed without you (a safety rule, the roaster): start again from there too. */
  #followReportedHeater(run: RoastRun, reading: Reading): void {
    const reported = reading.values.heater;
    const before = this.#lastReportedHeater;
    this.#lastReportedHeater = reported;
    if (reported === undefined || before === undefined || reported === before) return;
    if (!this.#set.pending('heater', reading.atMs)) run.restartControl(reported);
  }

  #publish(): void {
    const status = this.status;
    const json = JSON.stringify(status);
    if (json === this.#lastStatus) return;
    this.#lastStatus = json;
    this.#notify(status);
  }
}
