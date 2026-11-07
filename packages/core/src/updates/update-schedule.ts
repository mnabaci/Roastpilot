import type { Clock } from '../clock';

/** The first check waits this long after launch, so it never slows the start. */
export const FIRST_CHECK_MS = 10_000;
/** Then once a day (docs/spec/install-and-update.md). */
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
/** How often the schedule looks whether a check is due; short, so a slept-through day is caught. */
export const SCHEDULE_POLL_MS = 60 * 60 * 1000;

export interface UpdateScheduleDeps {
  clock: Clock;
  /** Wall-clock milliseconds (epoch): unlike the clock, it moves on while the computer sleeps. */
  wallNowMs: () => number;
  /** Runs one check; never rejects. */
  check: () => Promise<void>;
}

/**
 * When to check: 10 s after start, then whenever a day has passed since the last check began. A
 * computer that slept for days catches up with one check, not one per missed day.
 */
export class UpdateSchedule {
  readonly #deps: UpdateScheduleDeps;
  #lastCheckMs: number | null = null;
  #stopped = false;
  #started = false;

  constructor(deps: UpdateScheduleDeps) {
    this.#deps = deps;
  }

  /** Runs until `stop`; resolves then. */
  async run(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    await this.#deps.clock.delay(FIRST_CHECK_MS);
    while (!this.#stopped) {
      if (this.due()) await this.#deps.check();
      await this.#deps.clock.delay(SCHEDULE_POLL_MS);
    }
  }

  /** A check began (scheduled or asked for): the next one is a day from now. */
  checked(): void {
    this.#lastCheckMs = this.#deps.wallNowMs();
  }

  /** No check yet, a day since the last, or the computer's clock was set back. */
  due(): boolean {
    if (this.#stopped) return false;
    if (this.#lastCheckMs === null) return true;
    const elapsed = this.#deps.wallNowMs() - this.#lastCheckMs;
    return elapsed >= CHECK_EVERY_MS || elapsed < 0;
  }

  /** No more checks; the waiting delay resolves into nothing. */
  stop(): void {
    this.#stopped = true;
  }
}
