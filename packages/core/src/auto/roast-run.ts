import type { AutoProfile, AutoTuning } from '@roastpilot/shared';
import { dueEndRule, type EndRule } from './end-rules';
import { heatControlFor, type OutputController } from './heat-control';
import { advancePhase, dryEndReached } from './phase-plan';
import { StallGuard } from './stall-guard';

/** What Auto records about a roast (docs/spec/data-model.md, Auto mode). */
export type AutoEvent =
  | { kind: 'phase'; name: string }
  | { kind: 'dry-end' }
  | { kind: 'stall-guard'; tripped: boolean }
  | { kind: 'override'; channel: string; value: number };

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
  #index = 0;
  #phaseStartedS = 0;
  #control: OutputController | undefined;
  #lastMs: number;
  #dryEnd = false;
  #stallTripped = false;

  constructor(profile: AutoProfile, tuning: AutoTuning, chargedAtMs: number) {
    this.#profile = profile;
    this.#tuning = tuning;
    this.#chargedAtMs = chargedAtMs;
    this.#lastMs = chargedAtMs;
  }

  get chargedAtMs(): number {
    return this.#chargedAtMs;
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

  /** Resume auto: the phase's heat control starts over from the live reading. */
  restartControl(): void {
    this.#control = undefined;
  }

  tick({ nowMs, btC, ror, firstCrackAtMs }: RoastTickInput): RoastTick {
    const events: AutoEvent[] = [];
    const elapsedS = (nowMs - this.#chargedAtMs) / 1_000;
    const dtS = (nowMs - this.#lastMs) / 1_000;
    this.#lastMs = nowMs;

    const nextIndex = advancePhase(this.#profile, this.#index, { elapsedS, btC });
    if (nextIndex !== this.#index) {
      this.#index = nextIndex;
      this.#phaseStartedS = elapsedS;
      this.#control = undefined;
      events.push({ kind: 'phase', name: this.phaseName ?? '' });
    }
    if (!this.#dryEnd && dryEndReached(this.#profile, this.#index, btC)) {
      this.#dryEnd = true;
      events.push({ kind: 'dry-end' });
    }

    const phase = this.#profile.phases[this.#index];
    const plannedFanPct = phase?.fanPct ?? 0;
    // The soak is fixed by design: the guard starts when the soak ends.
    const guarded =
      this.#index > 0
        ? this.#guard.update({
            elapsedS,
            ror,
            plannedFanPct,
            firstCracked: firstCrackAtMs !== null,
          })
        : { tripped: false, fanPct: plannedFanPct };
    if (guarded.tripped !== this.#stallTripped) {
      this.#stallTripped = guarded.tripped;
      events.push({ kind: 'stall-guard', tripped: guarded.tripped });
    }

    if (phase && !this.#control) {
      this.#control = heatControlFor(phase.heat, this.#tuning, this.#profile.curve);
    }
    const heaterPct =
      this.#control?.next({
        elapsedS,
        phaseElapsedS: elapsedS - this.#phaseStartedS,
        dtS,
        btC,
        ror,
        stallTripped: guarded.tripped,
      }) ?? 0;

    const sinceFirstCrackS = firstCrackAtMs === null ? undefined : (nowMs - firstCrackAtMs) / 1_000;
    const endRule = dueEndRule({ profile: this.#profile, sinceFirstCrackS, btC });
    return { heaterPct, fanPct: guarded.fanPct, endRule, events };
  }
}
