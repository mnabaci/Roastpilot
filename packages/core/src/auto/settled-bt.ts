/** How many readings a temperature must hold for before Auto acts on it. */
export const SETTLE_READINGS = 3;

/**
 * The BT that phases, dry end, the cap and the heat control act on: the middle of the last three
 * readings, so one bad reading can't skip a phase or end a roast (docs/spec/roast-control.md).
 */
export class SettledBt {
  readonly #last: number[] = [];

  /** The settled BT after this reading; undefined when this reading has none. */
  next(btC: number | undefined): number | undefined {
    if (btC === undefined || !Number.isFinite(btC)) return undefined;
    this.#last.push(btC);
    if (this.#last.length > SETTLE_READINGS) this.#last.shift();
    const sorted = [...this.#last].sort((a, b) => a - b);
    // Until there are three, the lowest: a spike in the first readings can't fire a trigger either.
    return sorted.length === SETTLE_READINGS ? sorted[1] : sorted[0];
  }
}
