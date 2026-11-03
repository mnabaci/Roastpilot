import type { Reading } from '@roastpilot/shared';

/** About two hours at one reading per second: far more than any roast, and a bounded memory. */
export const MAX_HISTORY_READINGS = 7_200;

/** The current roast's readings, kept in main so a reloaded window gets its chart back. */
export class ReadingHistory {
  #readings: Reading[] = [];

  add(reading: Reading): void {
    this.#readings.push(reading);
    if (this.#readings.length > MAX_HISTORY_READINGS)
      this.#readings.splice(0, this.#readings.length - MAX_HISTORY_READINGS);
  }

  /** A new roast starts (Preheat): forget the old one. */
  clear(): void {
    this.#readings = [];
  }

  latest(): Reading | undefined {
    return this.#readings.at(-1);
  }

  all(): readonly Reading[] {
    return this.#readings;
  }
}
