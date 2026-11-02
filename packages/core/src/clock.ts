/** Milliseconds since an arbitrary start. Injected so every rule and driver runs on fake time in tests. */
export interface Clock {
  now(): number;
}

/** A clock that only moves when told to. For tests and simulations. */
export class ManualClock implements Clock {
  #nowMs: number;

  constructor(startMs = 0) {
    this.#nowMs = startMs;
  }

  now(): number {
    return this.#nowMs;
  }

  advance(ms: number): void {
    if (ms < 0) throw new Error(`ManualClock cannot go back in time (advance ${ms} ms)`);
    this.#nowMs += ms;
  }
}
