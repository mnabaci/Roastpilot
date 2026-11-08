import { lastRoastEndMs, pickPreheatHold, type PreheatHold } from '@roastpilot/core';
import type { AutoTuning, Roaster, RoastPhase, RoastState, RoastSummary } from '@roastpilot/shared';

export interface PreheatHoldPickerDeps {
  activeRoaster: () => Pick<Roaster, 'id'> & { tuning: Pick<AutoTuning, 'holdS' | 'nextHoldS'> };
  /** Wall-clock ms, as saved roasts keep their times. */
  nowMs: () => number;
}

/**
 * Which hold the next preheat runs (docs/spec/roast-control.md, Roast phases 1.3): the active
 * roaster's next-batch hold within 20 min of its last roast's end, else its first-batch hold.
 * Your choice for a roast goes on top, in AutoPilot.
 */
export class PreheatHoldPicker {
  readonly #deps: PreheatHoldPickerDeps;
  /** Each roaster's last roast end, wall-clock ms. */
  readonly #lastEnd = new Map<number, number>();
  #phase: RoastPhase | undefined;

  constructor(deps: PreheatHoldPickerDeps) {
    this.#deps = deps;
  }

  /** From the saved roasts, so a restart still knows the drum is hot. A newer end already seen wins. */
  load(roasts: readonly RoastSummary[]): void {
    const ids = new Set(roasts.flatMap((r) => (r.roasterId === null ? [] : [r.roasterId])));
    for (const id of ids) {
      const ended = lastRoastEndMs(roasts, id);
      if (ended !== null) this.#noteEnd(id, ended);
    }
  }

  /** A roast reaching Drop, or ending without one, leaves the drum hot; a stopped preheat doesn't. */
  onRoastChange(state: RoastState): void {
    const before = this.#phase;
    this.#phase = state.phase;
    if (before === state.phase) return;
    const roastEnded =
      state.phase === 'cooling' ||
      (state.phase === 'done' && (before === 'roasting' || before === 'development'));
    if (roastEnded) this.#noteEnd(this.#deps.activeRoaster().id, this.#deps.nowMs());
  }

  /** The hold a preheat starting now runs. */
  current(): PreheatHold {
    const roaster = this.#deps.activeRoaster();
    return pickPreheatHold(
      roaster.tuning,
      this.#lastEnd.get(roaster.id) ?? null,
      this.#deps.nowMs(),
    );
  }

  #noteEnd(roasterId: number, atMs: number): void {
    const known = this.#lastEnd.get(roasterId);
    if (known === undefined || atMs > known) this.#lastEnd.set(roasterId, atMs);
  }
}
