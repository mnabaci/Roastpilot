import type { RoastState } from '@roastpilot/shared';
import { formatClock, formatNumber } from '@roastpilot/ui';

const clock = (fromMs: number | null, toMs: number | null | undefined) =>
  fromMs !== null && toMs !== null && toMs !== undefined
    ? formatClock(Math.max(0, toMs - fromMs) / 1000)
    : undefined;

/**
 * How long each finished stage took, one per stepper step (Preheat, Roast, First crack, Drop,
 * Cool); undefined for a stage that isn't over (docs/spec/manual-mode.md, Stage times).
 */
export function stageTimes(roast: RoastState): (string | undefined)[] {
  const { preheatAtMs, chargedAtMs, firstCrackAtMs, droppedAtMs } = roast;
  const coolEndMs = roast.events.find((e) => e.kind === 'cool-end')?.atMs;
  const roastEndMs = firstCrackAtMs ?? droppedAtMs;
  const development = clock(firstCrackAtMs, droppedAtMs);
  const share =
    firstCrackAtMs !== null && droppedAtMs !== null && chargedAtMs !== null
      ? formatNumber(
          ((droppedAtMs - firstCrackAtMs) / Math.max(1, droppedAtMs - chargedAtMs)) * 100,
          0,
        )
      : undefined;
  return [
    clock(preheatAtMs, chargedAtMs),
    clock(chargedAtMs, roastEndMs),
    development && share ? `${development} · ${share}%` : development,
    undefined,
    clock(droppedAtMs, coolEndMs),
  ];
}
