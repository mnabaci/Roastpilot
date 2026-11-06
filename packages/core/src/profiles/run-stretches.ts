import type { SavedSample } from '@roastpilot/shared';
import { BEAN_TEMP, HEATER } from '../safety/safety-rule';

const FAN = 'fan';
/** At most this many steps between Soak and Development: six running steps in all. */
const MAX_STEPS = 5;
const SHORTEST_STEP_S = 20;

export interface Point {
  tS: number;
  bt: number;
  heater: number;
  fan: number;
}

/** A stretch of the roast with the same outputs. */
export interface Stretch {
  from: Point;
  to: Point;
  /** Heater % × seconds, for the average over merged stretches. */
  heatArea: number;
  /** The fan it ends on. */
  fan: number;
}

/** The run from charge to drop, with each output carried forward where a reading lacks it. */
export function runPoints(samples: readonly SavedSample[], dropS: number): Point[] {
  let heater = 0;
  let fan = 0;
  return samples.flatMap(({ tS, values }) => {
    heater = values[HEATER] ?? heater;
    fan = values[FAN] ?? fan;
    const bt = values[BEAN_TEMP];
    return tS >= 0 && tS <= dropS && bt !== undefined ? [{ tS, bt, heater, fan }] : [];
  });
}

export function stretches(
  points: readonly Point[],
  same: (a: Point, b: Point) => boolean,
): Stretch[] {
  const all: Stretch[] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    const last = all.at(-1);
    if (!previous || !last) {
      all.push({ from: point, to: point, heatArea: 0, fan: point.fan });
      return;
    }
    last.heatArea += previous.heater * (point.tS - previous.tS);
    last.to = point;
    if (!same(previous, point)) all.push({ from: point, to: point, heatArea: 0, fan: point.fan });
  });
  return all;
}

export const lengthS = (s: Stretch) => s.to.tS - s.from.tS;

/** Joins a stretch to the one after it, or before it when it's the last. */
function mergeAt(all: readonly Stretch[], index: number): Stretch[] {
  const at = index < all.length - 1 ? index : index - 1;
  const first = all[at];
  const second = all[at + 1];
  if (!first || !second) return [...all];
  const merged = {
    from: first.from,
    to: second.to,
    heatArea: first.heatArea + second.heatArea,
    fan: second.fan,
  };
  return [...all.slice(0, at), merged, ...all.slice(at + 2)];
}

export const roundedC = (s: Stretch) => Math.round(s.to.bt);

/** Steps must end hotter than the one before, be long enough to run, and number at most five. */
export function mergedSteps(all: readonly Stretch[]): Stretch[] {
  let steps = [...all];
  for (;;) {
    const flat = steps.findIndex((s, i) => {
      const before = steps[i - 1];
      return before !== undefined && roundedC(s) <= roundedC(before);
    });
    const shortest = steps.reduce(
      (best, s, i) => (lengthS(s) < lengthS(steps[best] ?? s) ? i : best),
      0,
    );
    const shortestStep = steps[shortest];
    if (steps.length <= 1 || !shortestStep) return steps;
    if (flat >= 0) steps = mergeAt(steps, flat - 1);
    else if (steps.length > MAX_STEPS || lengthS(shortestStep) < SHORTEST_STEP_S) {
      steps = mergeAt(steps, shortest);
    } else return steps;
  }
}
