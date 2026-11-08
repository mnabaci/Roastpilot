import type { Clock } from '@roastpilot/core';

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Monotonic, so a system clock change can't fool the lost-connection rule (docs/spec/architecture.md). */
export const systemClock: Clock = { now: () => performance.now(), delay };

/** The calendar time, for dates that are saved; never for timing a roast. */
export const wallClock: Clock = { now: () => Date.now(), delay };
