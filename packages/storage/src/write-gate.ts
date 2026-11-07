/**
 * One transaction at a time on a connection. `node:sqlite` runs each statement synchronously, but
 * the repositories are async: between two awaits of a transaction, another call could slip a
 * statement in. While a transaction holds the gate, statements from outside wait for it to end.
 *
 * Each method checks the gate and acts in the same synchronous step, so nothing can take it in
 * between.
 */
export class WriteGate {
  #held: Promise<void> | undefined;

  /** Runs `work` once no transaction holds the gate; it runs at once when none does. */
  async enter<T>(work: () => T): Promise<T> {
    while (this.#held) await this.#held;
    return work();
  }

  /** Runs `work` holding the gate: other `enter` and `hold` calls wait until it settles. */
  async hold<T>(work: () => Promise<T>): Promise<T> {
    while (this.#held) await this.#held;
    let release = (): void => undefined;
    this.#held = new Promise((resolve) => {
      release = resolve;
    });
    try {
      return await work();
    } finally {
      this.#held = undefined;
      release();
    }
  }
}
