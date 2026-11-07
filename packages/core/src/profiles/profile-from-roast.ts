import {
  AutoProfileSchema,
  PROFILE_LIMITS,
  PROFILE_SCHEMA_VERSION,
  type AutoProfile,
  type CurvePoint,
  type ProfilePhase,
  type RoastDetail,
} from '@roastpilot/shared';
import {
  lengthS,
  mergedSteps,
  roundedC,
  runPoints,
  stretches,
  type Point,
  type Stretch,
} from './run-stretches';
import { simplifyCurve } from './simplify-curve';

/** A roast with fewer readings than this has too little to go on. */
const MIN_SAMPLES = 30;
const ROR_MARGIN = 1;
const BACKUP_MARGIN_S = 60;
const CAP_MARGIN_C = 3;
const FALLBACK_DRY_END_C = 150;
const CURVE_POINTS = 10;

export type ProfileStyle = 'steps' | 'curve';

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
  const durationS = Math.min(
    Math.max(Math.round(lengthS(stretch)), 1),
    PROFILE_LIMITS.durationS.max,
  );
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

/** A saved roast cut into soak, steps and development. */
interface Run {
  points: Point[];
  first: Point;
  dryEndC: number;
  /** The hottest reading after the turning point. */
  peakC: number;
  soakS: number;
  steps: Stretch[];
  development: Stretch;
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

/** Soak at heater 0, a phase per step, then development until the end rule. */
function runPhases({ first, soakS, steps, development }: Run, style: ProfileStyle): ProfilePhase[] {
  return [
    {
      name: 'Soak',
      heat: { mode: 'fixed', pct: 0 },
      fanPct: first.fan,
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
  ];
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
