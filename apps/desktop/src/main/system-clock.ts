import type { Clock } from '@roastpilot/core';

/** Monotonic, so a system clock change can't fool the lost-connection rule (docs/spec/architecture.md). */
export const systemClock: Clock = {
  now: () => performance.now(),
  delay: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
};
