import type { Logger } from '@roastpilot/core';
import type { Tc4Reply } from './tc4-dialect';

/**
 * The board echoes the heater and fan it is sending. When that isn't what we sent, something else
 * changed it (the board's own failsafe, or a garbled reply): log it with the raw line, once when it
 * starts and once when it matches again, so the cause can be found (docs/spec/hardware.md).
 */
export class BoardEcho {
  readonly #logger: Logger;
  readonly #changed = new Set<string>();

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  note(reply: Tc4Reply, sent: ReadonlyMap<string, number>, line: string): void {
    for (const channel of ['heater', 'fan'] as const) {
      const value = sent.get(channel);
      const reported = reply[channel];
      if (reported !== value && !this.#changed.has(channel)) {
        this.#changed.add(channel);
        this.#logger.warn('driver.output-changed-by-board', {
          channel,
          sent: value,
          reported,
          line,
        });
      } else if (reported === value && this.#changed.delete(channel)) {
        this.#logger.info('driver.output-matches-again', { channel, value: reported });
      }
    }
  }
}
