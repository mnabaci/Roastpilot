import { expectedFirstCrackC, serializeError, type Logger } from '@roastpilot/core';
import type { RoastSummary } from '@roastpilot/shared';

/**
 * The expected first crack for the coach, the same as for the Listen for first crack sound
 * (docs/spec/ui.md, Sounds): worked out from History at each charge, so a reading never waits on it.
 */
export class FirstCrackExpectation {
  readonly #list: () => Promise<RoastSummary[]>;
  readonly #roasterId: () => number | undefined;
  readonly #logger: Logger;
  #expectedC: number | undefined;

  constructor(deps: {
    list: () => Promise<RoastSummary[]>;
    roasterId: () => number | undefined;
    logger: Logger;
  }) {
    this.#list = deps.list;
    this.#roasterId = deps.roasterId;
    this.#logger = deps.logger;
  }

  get expectedC(): number | undefined {
    return this.#expectedC;
  }

  /** Reads History again; until it answers, the last value stands. */
  refresh(): void {
    this.#list()
      .then((roasts) => {
        this.#expectedC = expectedFirstCrackC(roasts, this.#roasterId());
      })
      .catch((error: unknown) => {
        this.#logger.error('coach.expected-first-crack-failed', { error: serializeError(error) });
      });
  }
}
