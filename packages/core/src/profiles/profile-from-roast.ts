import {
  AutoProfileSchema,
  PROFILE_LIMITS,
  PROFILE_SCHEMA_VERSION,
  type AutoProfile,
  type CurvePoint,
  type RoastDetail,
} from '@roastpilot/shared';
import { runPhases, type ProfileStyle, type RunCut } from './run-phases';
import { mergedSteps, runPoints, stretches, type Point } from './run-stretches';

export type { ProfileStyle } from './run-phases';
import { simplifyCurve } from './simplify-curve';

/** A roast with fewer readings than this has too little to go on. */
const MIN_SAMPLES = 30;
const CAP_MARGIN_C = 3;
const FALLBACK_DRY_END_C = 150;
const CURVE_POINTS = 10;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** A saved roast cut into soak, steps and development, with what the profile's top values need. */
interface Run extends RunCut {
  points: Point[];
  dryEndC: number;
  /** The hottest reading after the turning point. */
  peakC: number;
}

/** The run from charge to drop, cut into phases; undefined when it has too little to go on. */
function readRun(
  roast: RoastDetail,
  style: ProfileStyle,
  { dropTimeS, fcTimeS }: { dropTimeS: number; fcTimeS: number },
): Run | undefined {
  const points = runPoints(roast.samples, dropTimeS);
  const dryEndC =
    roast.events.find((e) => e.kind === 'dry-end')?.bt ??
    roast.profile?.dryEndC ??
    FALLBACK_DRY_END_C;
  // The hot reading at charge says nothing about the roast: everything counts from the turning point.
  const beforeCrack = points.filter((p) => p.tS <= fcTimeS);
  const turning = beforeCrack.reduce<Point | undefined>(
    (low, p) => (low === undefined || p.bt < low.bt ? p : low),
    undefined,
  );
  const [first] = points;
  if (!turning || !first) return undefined;
  const peakC = points
    .filter((p) => p.tS >= turning.tS)
    .reduce((peak, p) => Math.max(peak, p.bt), 0);
  if (points.length < MIN_SAMPLES || peakC <= dryEndC) return undefined;

  const soakEnd = points.findIndex((p) => p.heater > 0);
  const soakS = soakEnd > 0 ? (points[soakEnd]?.tS ?? 0) : 0;
  const startS = Math.max(soakS, turning.tS);
  const rising = beforeCrack.filter((p) => p.tS >= startS);
  const sameOutputs =
    style === 'curve'
      ? (a: Point, b: Point) => a.fan === b.fan
      : (a: Point, b: Point) => a.fan === b.fan && a.heater === b.heater;
  const steps = mergedSteps(stretches(rising, sameOutputs));
  const [development] = stretches(
    points.filter((p) => p.tS >= fcTimeS),
    () => true,
  );
  if (!development || steps.length === 0) return undefined;
  return { points, first, dryEndC, peakC, soakS, steps, development };
}

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
  const run = readRun(roast, style, { dropTimeS, fcTimeS });
  if (!run) return undefined;

  const capC = Math.min(Math.ceil(run.peakC) + CAP_MARGIN_C, PROFILE_LIMITS.capC.max);
  const chargeC = clamp(
    Math.round(roast.events.find((e) => e.kind === 'charge')?.bt ?? run.first.bt),
    PROFILE_LIMITS.chargeC.min,
    PROFILE_LIMITS.chargeC.max,
  );
  // Auto would drop at the cap straight after charge.
  if (chargeC >= capC) return undefined;
  const curve: CurvePoint[] = simplifyCurve(
    run.points.map((p) => ({ tS: p.tS, c: p.bt })),
    CURVE_POINTS,
  ).map((p) => ({ tS: Math.round(p.tS), c: Math.min(Math.round(p.c), capC) }));

  const parsed = AutoProfileSchema.safeParse({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id,
    name: `Roast ${String(roast.id)} · ${style === 'curve' ? 'Curve' : 'Steps'}`,
    source: { kind: 'roast', roastId: roast.id },
    // A roast made here ran on this roaster, so there is nothing to calibrate. An imported one
    // ran somewhere else (a matching roaster name proves nothing), so its heat needs checking.
    needsCalibration: roast.imported,
    batchG: roast.batchG ?? roast.profile?.batchG ?? fallbackBatchG,
    chargeC,
    dryEndC: Math.round(run.dryEndC),
    devTimeS: clamp(
      Math.round(dropTimeS - fcTimeS),
      PROFILE_LIMITS.devTimeS.min,
      PROFILE_LIMITS.devTimeS.max,
    ),
    capC,
    // Rounding can put two points on the same second: keep the first.
    curve: curve.filter((p, i) => p.tS > (curve[i - 1]?.tS ?? -1)),
    phases: runPhases(run, style),
  });
  return parsed.success ? parsed.data : undefined;
}
