import type { CoachAdvice, CoachSetting } from '@roastpilot/shared';
import type { CoachOutputs, CoachTip } from './coach-rule';
import { SUGGEST_FROM_PCT } from './setting-rule';

/** At most one new setting suggestion this often (docs/spec/manual-mode.md, Coach). */
export const NEW_SUGGESTION_EVERY_MS = 15_000;

type HeadsUpKind = Exclude<CoachAdvice['kind'], 'setting'>;
type Gaps = CoachOutputs<number>;

/** What the card is shown, each reading: the rules' tips in order, and where the roast is. */
export interface CardView {
  tips: readonly CoachTip[];
  nowMs: number;
  /** Auto's phase: a dismissed suggestion comes back in the next one. */
  phaseIndex: number;
  /** How far Auto's setting is from yours, per output, in points. */
  gaps: Gaps;
  set: CoachOutputs<number | undefined>;
}

const OUTPUTS = ['heater', 'fan'] as const;

const sameChanges = (a: CoachSetting, b: Extract<CoachTip, { kind: 'setting' }>): boolean =>
  OUTPUTS.every((o) => a[o]?.from === b[o]?.from && a[o]?.to === b[o]?.to);

/** Every output the card names is still set where the card says it is. */
const stillFrom = (shown: CoachSetting, set: CoachOutputs<number | undefined>): boolean =>
  OUTPUTS.every((o) => shown[o] === undefined || shown[o].from === set[o]);

/**
 * The coach card for one roast: which tip shows, under what id, and what you dismissed. Setting
 * suggestions are throttled; heads-ups count down in place.
 */
export class CoachCard {
  #shown: CoachAdvice | null = null;
  #nextId = 1;
  #lastSettingAtMs: number | undefined;
  #dismissedSetting: { phaseIndex: number; gaps: Gaps } | undefined;
  readonly #dismissedHeadsUps = new Set<HeadsUpKind>();
  #last: CardView | undefined;

  get shown(): CoachAdvice | null {
    return this.#shown;
  }

  /** A new roast: nothing dismissed, nothing waiting. Ids keep counting, so none comes back. */
  reset(): void {
    this.#shown = null;
    this.#lastSettingAtMs = undefined;
    this.#dismissedSetting = undefined;
    this.#dismissedHeadsUps.clear();
    this.#last = undefined;
  }

  /** The card goes, at once; what you dismissed stays dismissed. */
  clear(): void {
    this.#shown = null;
  }

  /** Shows the first tip you haven't dismissed; returns advice that is new on the card. */
  update(view: CardView): CoachAdvice | undefined {
    this.#last = view;
    for (const tip of view.tips) {
      if (this.#dismissed(tip, view)) continue;
      if (tip.kind !== 'setting') return this.#headsUp(tip);
      const shown = this.#shown;
      if (shown?.kind === 'setting' && sameChanges(shown, tip)) return undefined;
      if (this.#throttled(view.nowMs)) {
        // The one showing waits for its 15 s, while it still starts from what is set.
        if (shown?.kind === 'setting' && stillFrom(shown, view.set)) return undefined;
        continue;
      }
      this.#lastSettingAtMs = view.nowMs;
      return this.#post(tip);
    }
    this.#shown = null;
    return undefined;
  }

  /** Hides the card with this id; returns it, or undefined when it has already changed. */
  dismiss(id: number): CoachAdvice | undefined {
    const shown = this.#shown;
    if (shown?.id !== id) return undefined;
    if (shown.kind === 'setting') {
      const gapNow = this.#last?.gaps ?? { heater: 0, fan: 0 };
      const gap = (o: (typeof OUTPUTS)[number]) => {
        const change = shown[o];
        return change ? Math.abs(change.to - change.from) : gapNow[o];
      };
      this.#dismissedSetting = {
        phaseIndex: this.#last?.phaseIndex ?? 0,
        gaps: { heater: gap('heater'), fan: gap('fan') },
      };
    } else this.#dismissedHeadsUps.add(shown.kind);
    this.#shown = null;
    return shown;
  }

  /** Takes the setting suggestion with this id off the card, for Apply; undefined when it changed. */
  claim(id: number): CoachSetting | undefined {
    const shown = this.#shown;
    if (shown?.kind !== 'setting' || shown.id !== id) return undefined;
    this.#shown = null;
    return shown;
  }

  #dismissed(tip: CoachTip, view: CardView): boolean {
    if (tip.kind !== 'setting') return this.#dismissedHeadsUps.has(tip.kind);
    const dismissed = this.#dismissedSetting;
    if (dismissed?.phaseIndex !== view.phaseIndex) return false;
    // It speaks again once Auto wants 10 points more than the one you dismissed.
    return OUTPUTS.every((o) => view.gaps[o] < dismissed.gaps[o] + SUGGEST_FROM_PCT);
  }

  #throttled(nowMs: number): boolean {
    const last = this.#lastSettingAtMs;
    return last !== undefined && nowMs - last < NEW_SUGGESTION_EVERY_MS;
  }

  /** The same heads-up counts down under its id; another one is new. */
  #headsUp(tip: Exclude<CoachTip, { kind: 'setting' }>): CoachAdvice | undefined {
    const shown = this.#shown;
    if (shown?.kind === tip.kind) {
      this.#shown = { ...tip, id: shown.id };
      return undefined;
    }
    return this.#post(tip);
  }

  #post(tip: CoachTip): CoachAdvice {
    const advice: CoachAdvice = { ...tip, id: this.#nextId++ };
    this.#shown = advice;
    return advice;
  }
}
