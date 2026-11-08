import type { AutoProfile, AutoTuning, Reading } from '@roastpilot/shared';
import { BEAN_TEMP } from '../safety/safety-rule';
import { dueEndRule, type EndRule } from './end-rules';
import { heatControlFor } from './heat-control';
import type { OutputController } from './output-controller';
import { DryEndWatch } from './dry-end-watch';
import { advancePhase, isSoak } from './phase-plan';
import { SettledBt } from './settled-bt';
import { StallGuard } from './stall-guard';

/**
 * The longest time step the heat control is given. Readings come every second; a longer gap
 * (Auto stopped, readings lost) must not land on the integral all at once.
 */
export const MAX_STEP_S = 3;

/** What Auto records about a roast (docs/spec/data-model.md, Auto mode). */
export type AutoEvent =
  | { kind: 'phase'; name: string }
  | { kind: 'dry-end' }
  | { kind: 'stall-guard'; tripped: boolean }
  | { kind: 'override'; channel: string; value: number }
  | { kind: 'mode'; auto: boolean };

export interface RoastTickInput {
  nowMs: number;
  btC: number | undefined;
  ror: number | undefined;
  firstCrackAtMs: number | null;
}

export interface RoastTick {
  heaterPct: number;
  fanPct: number;
  /** Drop now, by this rule. */
  endRule: EndRule | undefined;
  events: readonly AutoEvent[];
}

/** One roast's phases from charge to drop: which phase runs, and what it asks of heater and fan. */
export class RoastRun {
  readonly #profile: AutoProfile;
  readonly #tuning: AutoTuning;
  readonly #chargedAtMs: number;
  readonly #guard = new StallGuard();
  readonly #bt = new SettledBt();
  #index = 0;
  #phaseStartedS = 0;
  #control: OutputController | undefined;
  #lastMs: number;
  readonly #dryEnd: DryEndWatch;
  #stallTripped = false;
  /** The heater sent last, and what a following curve phase starts from. */
  #lastHeaterPct: number | undefined;
  #carryPct: number | undefined;

  constructor(profile: AutoProfile, tuning: AutoTuning, chargedAtMs: number) {
    this.#profile = profile;
    this.#tuning = tuning;
    this.#chargedAtMs = chargedAtMs;
    this.#lastMs = chargedAtMs;
    this.#dryEnd = new DryEndWatch(profile);
  }

  get chargedAtMs(): number {
    return this.#chargedAtMs;
  }

  /** The phase running, by its place in the profile: a new phase is a new number. */
  get phaseIndex(): number {
    return this.#index;
  }

  /** Seconds after charge the running phase began. */
  get phaseStartedS(): number {
    return this.#phaseStartedS;
  }

  get phaseName(): string | null {
    return this.#profile.phases[this.#index]?.name ?? null;
  }

  get nextPhaseAtC(): number | null {
    const next = this.#profile.phases[this.#index]?.next;
    return next?.on === 'bt' ? next.c : null;
  }

  get stallTripped(): boolean {
    return this.#stallTripped;
  }

  /**
   * Resume auto: the phase's heat control starts over from the live reading. The heater worked out
   * while stopped never reached the roaster; the heater it reports, `heaterNowPct`, did. A curve
   * phase slews from there to its estimate, so handing back never jumps the heater (ADR 0016);
   * without a usable reading it starts at the estimate.
   */
  restartControl(heaterNowPct?: number): void {
    const known =
      heaterNowPct !== undefined && Number.isFinite(heaterNowPct)
        ? Math.min(100, Math.max(0, heaterNowPct))
        : undefined;
    const follow = this.#profile.phases[this.#index]?.heat.mode === 'follow';
    this.#control = undefined;
    this.#lastHeaterPct = known;
    this.#carryPct = follow ? known : undefined;
  }

  /**
   * Auto turned on mid-roast: replays the readings since charge, quietly, so the run starts in the
   * phase the roast has reached, timed from when it really began, and nothing is sent or recorded.
   */
  catchUp(readings: readonly { atMs: number; btC: number | undefined }[]): void {
    for (const { atMs, btC: rawBtC } of readings) {
      const elapsedS = (atMs - this.#chargedAtMs) / 1_000;
      const btC = this.#bt.next(rawBtC);
      const nextIndex = advancePhase(this.#profile, this.#index, { elapsedS, btC });
      if (nextIndex !== this.#index) {
        this.#index = nextIndex;
        this.#phaseStartedS = elapsedS;
      }
      this.#dryEnd.next(this.#index, btC);
      this.#lastMs = atMs;
    }
  }

  tick({ nowMs, btC: rawBtC, ror, firstCrackAtMs }: RoastTickInput): RoastTick {
    const events: AutoEvent[] = [];
    const elapsedS = (nowMs - this.#chargedAtMs) / 1_000;
    const dtS = Math.min(MAX_STEP_S, (nowMs - this.#lastMs) / 1_000);
    this.#lastMs = nowMs;
    const btC = this.#bt.next(rawBtC);
    const firstCracked = firstCrackAtMs !== null;

    const nextIndex = advancePhase(this.#profile, this.#index, { elapsedS, btC });
    if (nextIndex !== this.#index) {
      // Curve to curve, the heater goes on from where it was (ADR 0016); a soak hands over at once.
      const wasFollow = this.#profile.phases[this.#index]?.heat.mode === 'follow';
      this.#carryPct = wasFollow ? this.#lastHeaterPct : undefined;
      this.#index = nextIndex;
      this.#phaseStartedS = elapsedS;
      this.#control = undefined;
      events.push({ kind: 'phase', name: this.phaseName ?? '' });
    }
    if (this.#dryEnd.next(this.#index, btC)) events.push({ kind: 'dry-end' });

    const phase = this.#profile.phases[this.#index];
    const plannedFanPct = phase?.fanPct ?? 0;
    // The soak is fixed by design: the guard starts when the soak ends, or at charge without one.
    const guarded = !isSoak(this.#profile, this.#index)
      ? this.#guard.update({
          elapsedS,
          ror,
          plannedFanPct,
          firstCracked,
          // How the heat control ended the last reading: heat goes first, the fan last.
          heaterMaxed: this.#control?.maxed ?? false,
        })
      : { tripped: false, fanPct: plannedFanPct };
    if (guarded.tripped !== this.#stallTripped) {
      this.#stallTripped = guarded.tripped;
      events.push({ kind: 'stall-guard', tripped: guarded.tripped });
    }

    if (phase && !this.#control) {
      this.#control = heatControlFor(phase.heat, this.#tuning, this.#profile.curve, this.#carryPct);
      this.#carryPct = undefined;
    }
    const heaterPct =
      this.#control?.next({
        elapsedS,
        phaseElapsedS: elapsedS - this.#phaseStartedS,
        dtS,
        btC,
        ror,
        stallTripped: guarded.tripped,
        firstCracked,
      }) ?? 0;

    this.#lastHeaterPct = heaterPct;
    const sinceFirstCrackS = firstCrackAtMs === null ? undefined : (nowMs - firstCrackAtMs) / 1_000;
    const endRule = dueEndRule({ profile: this.#profile, sinceFirstCrackS, btC });
    return { heaterPct, fanPct: guarded.fanPct, endRule, events };
  }
}

/**
 * A run for the roast charged at `chargedAtMs`. Turned on mid-roast, it starts at the phase the
 * roast has reached, not the soak, from the readings since charge.
 */
export function startRoastRun(
  profile: AutoProfile,
  tuning: AutoTuning,
  chargedAtMs: number,
  readings: readonly Reading[],
): RoastRun {
  const run = new RoastRun(profile, tuning, chargedAtMs);
  const since = readings.filter((r) => r.atMs >= chargedAtMs);
  run.catchUp(since.map((r) => ({ atMs: r.atMs, btC: r.values[BEAN_TEMP] })));
  return run;
}
