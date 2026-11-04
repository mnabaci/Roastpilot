import type { Reading } from '@roastpilot/shared';
import { BEAN_TEMP } from '../safety/safety-rule';

/** Artisan looks for the turning point from 20 s after charge (`checkTPalarmtime`). */
const EARLIEST_MS = 20_000;
/** A turning point outside this range is a probe glitch, never marked (Artisan's 50–150 °C). */
const VALID_C = { min: 50, max: 150 } as const;

/**
 * The turning point (docs/spec/manual-mode.md), as Artisan finds it: once the last five readings
 * show BT no lower than the first of them and higher at the end, it is the lowest reading since
 * charge. `readings` are the ones since charge, oldest first. Undefined until then, or when the
 * lowest reading is outside 50–150 °C.
 */
export function findTurningPoint(
  readings: readonly Reading[],
  chargedAtMs: number,
): Reading | undefined {
  const since = readings.filter(
    (r) => r.atMs >= chargedAtMs && Number.isFinite(r.values[BEAN_TEMP]),
  );
  const last = since.at(-1);
  if (!last || last.atMs - chargedAtMs <= EARLIEST_MS || since.length < 5) return undefined;
  const bt = (r: Reading | undefined) => r?.values[BEAN_TEMP] ?? Number.NaN;
  const tail = since.slice(-5).map(bt);
  const [first = Number.NaN] = tail;
  if (!tail.slice(1).every((t) => first <= t) || !(first < bt(last))) return undefined;
  // Ties go to the later reading, as in Artisan's `findTPint`.
  const lowest = since.reduce((low, r) => (bt(r) <= bt(low) ? r : low));
  const temp = bt(lowest);
  return temp > VALID_C.min && temp < VALID_C.max ? lowest : undefined;
}
