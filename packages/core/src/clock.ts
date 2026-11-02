/** Time, injected so every rule and driver runs on fake time in tests. */
export interface Clock {
  /** Milliseconds since an arbitrary start. */
  now(): number;
  /** Resolves after `ms` milliseconds of this clock's time. */
  delay(ms: number): Promise<void>;
}

interface Timer {
  dueMs: number;
  resolve: () => void;
}

/** Lets queued promise callbacks run, so code waiting on a delay can react before time moves on. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

/** A clock that only moves when told to. For tests and simulations. */
export class ManualClock implements Clock {
  #nowMs: number;
  #timers: Timer[] = [];

  constructor(startMs = 0) {
    this.#nowMs = startMs;
  }

  now(): number {
    return this.#nowMs;
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.#timers.push({ dueMs: this.#nowMs + Math.max(0, ms), resolve });
    });
  }

  /** Jumps forward without running async work in between. Due delays resolve afterwards. */
  advance(ms: number): void {
    if (ms < 0) throw new Error(`ManualClock cannot go back in time (advance ${ms} ms)`);
    this.#nowMs += ms;
    this.#fireDue();
  }

  /** Moves forward timer by timer, letting async work run at each step, like real time would. */
  async runFor(ms: number): Promise<void> {
    if (ms < 0) throw new Error(`ManualClock cannot go back in time (runFor ${ms} ms)`);
    const endMs = this.#nowMs + ms;
    await flushMicrotasks();
    for (
      let next = this.#nextDueMs();
      next !== undefined && next <= endMs;
      next = this.#nextDueMs()
    ) {
      this.#nowMs = Math.max(this.#nowMs, next);
      this.#fireDue();
      await flushMicrotasks();
    }
    this.#nowMs = endMs;
  }

  #nextDueMs(): number | undefined {
    return this.#timers.reduce<number | undefined>(
      (min, t) => (min === undefined || t.dueMs < min ? t.dueMs : min),
      undefined,
    );
  }

  #fireDue(): void {
    const due = this.#timers
      .filter((t) => t.dueMs <= this.#nowMs)
      .sort((a, b) => a.dueMs - b.dueMs);
    this.#timers = this.#timers.filter((t) => t.dueMs > this.#nowMs);
    for (const timer of due) timer.resolve();
  }
}
