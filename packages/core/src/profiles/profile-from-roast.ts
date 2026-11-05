import {
  AutoProfileSchema,
  PROFILE_LIMITS,
  PROFILE_SCHEMA_VERSION,
  type AutoProfile,
  type CurvePoint,
  type ProfilePhase,
  type RoastDetail,
  type SavedSample,
} from '@roastpilot/shared';
import { BEAN_TEMP, HEATER } from '../safety/safety-rule';
import { simplifyCurve } from './simplify-curve';

const FAN = 'fan';
/** A roast with fewer readings than this has too little to go on. */
const MIN_SAMPLES = 30;
/** Soak, then at most this many steps, then Development: six running steps in all. */
const MAX_STEPS = 5;
const SHORTEST_STEP_S = 20;
const ROR_MARGIN = 1;
const BACKUP_MARGIN_S = 60;
const CAP_MARGIN_C = 3;
const FALLBACK_DRY_END_C = 150;
const CURVE_POINTS = 10;

export type ProfileStyle = 'steps' | 'curve';

interface Point {
  tS: number;
  bt: number;
  heater: number;
  fan: number;
}

/** A stretch of the roast with the same outputs. */
interface Stretch {
  from: Point;
  to: Point;
  /** Heater % × seconds, for the average over merged stretches. */
  heatArea: number;
  /** The fan it ends on. */
  fan: number;
}

/** The run from charge to drop, with each output carried forward where a reading lacks it. */
function runPoints(samples: readonly SavedSample[], dropS: number): Point[] {
  let heater = 0;
  let fan = 0;
  return samples.flatMap(({ tS, values }) => {
    heater = values[HEATER] ?? heater;
    fan = values[FAN] ?? fan;
    const bt = values[BEAN_TEMP];
    return tS >= 0 && tS <= dropS && bt !== undefined ? [{ tS, bt, heater, fan }] : [];
  });
}

function stretches(points: readonly Point[], same: (a: Point, b: Point) => boolean): Stretch[] {
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

const lengthS = (s: Stretch) => s.to.tS - s.from.tS;

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

const roundedC = (s: Stretch) => Math.round(s.to.bt);

/** Steps must end hotter than the one before, be long enough to run, and number at most five. */
function mergedSteps(all: readonly Stretch[]): Stretch[] {
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

const averageHeat = (s: Stretch) => {
  const length = lengthS(s);
  return Math.round(length > 0 ? s.heatArea / length : s.from.heater);
};

function phaseFrom(
  name: string,
  stretch: Stretch,
  style: ProfileStyle,
  next: ProfilePhase['next'],
): ProfilePhase {
  const durationS = Math.min(Math.max(lengthS(stretch), 1), PROFILE_LIMITS.durationS.max);
  const ror = ((stretch.to.bt - stretch.from.bt) / Math.max(lengthS(stretch), 1)) * 60;
  const pct = averageHeat(stretch);
  return {
    name,
    fanPct: stretch.fan,
    next,
    heat:
      style === 'curve'
        ? { mode: 'follow', pct }
        : {
            mode: 'target',
            pct,
            endC: roundedC(stretch),
            durationS,
            rorMin: Math.round(ror) - ROR_MARGIN,
            rorMax: Math.round(ror) + ROR_MARGIN,
          },
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * A new profile from a saved roast (docs/spec/beans-favourites-ghost.md, Favourite → step profile):
 * undefined when the run has too little to go on. The roast itself is never changed.
 */
export function profileFromRoast({
  roast,
  style,
  id,
  fallbackBatchG,
}: {
  roast: RoastDetail;
  style: ProfileStyle;
  id: string;
  fallbackBatchG: number;
}): AutoProfile | undefined {
  const { dropTimeS, fcTimeS } = roast;
  if (dropTimeS === null || fcTimeS === null) return undefined;
  const points = runPoints(roast.samples, dropTimeS);
  const dryEndC =
    roast.events.find((e) => e.kind === 'dry-end')?.bt ??
    roast.profile?.dryEndC ??
    FALLBACK_DRY_END_C;
  const peakC = points.reduce((peak, p) => Math.max(peak, p.bt), 0);
  if (points.length < MIN_SAMPLES || peakC <= dryEndC) return undefined;

  const soakEnd = points.findIndex((p) => p.heater > 0);
  const [firstPoint] = points;
  if (!firstPoint) return undefined;
  const soakS = soakEnd > 0 ? (points[soakEnd]?.tS ?? 0) : 0;
  const rising = points.filter((p) => p.tS >= soakS && p.tS <= fcTimeS);
  const sameOutputs =
    style === 'curve'
      ? (a: Point, b: Point) => a.fan === b.fan
      : (a: Point, b: Point) => a.fan === b.fan && a.heater === b.heater;
  const steps = mergedSteps(stretches(rising, sameOutputs));
  const development = stretches(
    points.filter((p) => p.tS >= fcTimeS),
    () => true,
  )[0];
  if (!development || steps.length === 0) return undefined;

  const capC = Math.min(Math.ceil(peakC) + CAP_MARGIN_C, PROFILE_LIMITS.capC.max);
  const chargeC = clamp(
    Math.round(roast.events.find((e) => e.kind === 'charge')?.bt ?? firstPoint.bt),
    PROFILE_LIMITS.chargeC.min,
    PROFILE_LIMITS.chargeC.max,
  );
  const curve: CurvePoint[] = simplifyCurve(
    points.map((p) => ({ tS: p.tS, c: p.bt })),
    CURVE_POINTS,
  ).map((p) => ({ tS: Math.round(p.tS), c: Math.min(Math.round(p.c), capC) }));

  const parsed = AutoProfileSchema.safeParse({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id,
    name: `Roast ${String(roast.id)} · ${style === 'curve' ? 'Curve' : 'Steps'}`,
    source: { kind: 'roast', roastId: roast.id },
    // It ran on this roaster, so there is nothing to calibrate.
    needsCalibration: false,
    batchG: roast.batchG ?? roast.profile?.batchG ?? fallbackBatchG,
    chargeC,
    dryEndC: Math.round(dryEndC),
    devTimeS: clamp(
      Math.round(dropTimeS - fcTimeS),
      PROFILE_LIMITS.devTimeS.min,
      PROFILE_LIMITS.devTimeS.max,
    ),
    capC,
    curve: curve.filter((p, i) => p.tS > (curve[i - 1]?.tS ?? -1)),
    phases: [
      {
        name: 'Soak',
        heat: { mode: 'fixed', pct: 0 },
        fanPct: firstPoint.fan,
        next: { on: 'time', afterS: Math.max(Math.round(soakS), 1) },
      },
      ...steps.map((step, index) =>
        phaseFrom(`Step ${String(index + 1)}`, step, style, {
          on: 'bt',
          c: roundedC(step),
          backupS: Math.round(step.to.tS) + BACKUP_MARGIN_S,
        }),
      ),
      phaseFrom('Development', development, style, { on: 'end' }),
    ],
  });
  return parsed.success ? parsed.data : undefined;
}
