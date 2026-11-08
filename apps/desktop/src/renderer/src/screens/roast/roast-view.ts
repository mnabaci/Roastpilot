import {
  focusWindow,
  nextFloorC,
  phaseBandEdges,
  projection,
  startFloorC,
  type TimeWindow,
} from '@roastpilot/core';
import type { RoastState, Settings } from '@roastpilot/shared';
import type { ChartAid, ChartPoint, LineLayer, PhaseBand } from '@roastpilot/ui';
import type { HeldView } from '../../stores/roast-view-store';

/** The chart's four aids, as set in Settings › Chart. */
export type ChartAidSettings = Pick<
  Settings,
  'chartProjection' | 'chartNowLine' | 'chartTemperatureFocus' | 'chartPhaseBands'
>;

export interface RoastViewInput {
  roast: RoastState;
  /** The latest drawn time, seconds since charge: it stops with the lines at cool end. */
  nowS: number | undefined;
  /** The drawn temperature there, where the projection starts. */
  btC: number | undefined;
  rorCPerMin: number | undefined;
  /** When this roast is expected to end (`expectedRoastEndS`). */
  expectedEndS: number;
  /** What was shown last for this roast: the window never comes back in, the floor never up. */
  previous: HeldView | undefined;
  /** Every line drawn: those on the temperature axis keep the fitted floor below them. */
  lines: readonly LineLayer[];
  /** The turning point to expect (`expectedTurningPointC`), which sets the floor at Start. */
  expectedTpC: number | undefined;
  settings: ChartAidSettings;
  profileDryEndC: number | undefined;
  expectedFirstCrackC: number | undefined;
}

export type { HeldView };

export interface RoastView {
  /** Undefined before Start: everything since Preheat. */
  timeWindow: TimeWindow | undefined;
  temperatureFloorC: number;
  aids: ChartAid[];
  /** What to keep for the next reading; undefined before Start. */
  held: HeldView | undefined;
}

const BEFORE_START: RoastView = {
  timeWindow: undefined,
  temperatureFloorC: 0,
  aids: [],
  held: undefined,
};

const eventBt = (roast: RoastState, kind: 'dry-end' | 'first-crack') =>
  roast.events.find((e) => e.kind === kind)?.bt ?? undefined;

/** Drying, Maillard and development, at the expected temperatures until they happen. */
function phaseBands(input: RoastViewInput): PhaseBand[] {
  const { dryEndC, firstCrackC } = phaseBandEdges({
    profileDryEndC: input.profileDryEndC,
    expectedFirstCrackC: input.expectedFirstCrackC,
    dryEndAtC: eventBt(input.roast, 'dry-end'),
    firstCrackAtC: eventBt(input.roast, 'first-crack'),
  });
  return [
    { label: 'Drying', toC: dryEndC },
    {
      label: 'Maillard',
      fromC: dryEndC,
      ...(firstCrackC === undefined ? {} : { toC: firstCrackC }),
    },
    ...(firstCrackC === undefined ? [] : [{ label: 'Development', fromC: firstCrackC }]),
  ];
}

/**
 * The RoR the chart draws now, °C/min: the RoR line's latest point. None in a gap, where the RoR
 * is outside Artisan's limits, so the projection follows the line you see.
 */
export function drawnRorCPerMin(lines: readonly LineLayer[]): number | undefined {
  return lines.find((l) => l.id === 'ror')?.points.at(-1)?.v ?? undefined;
}

/** Each aid that is switched on, back to front. */
function aidsOf(input: RoastViewInput, window: TimeWindow, nowS: number): ChartAid[] {
  const { settings } = input;
  const ahead = settings.chartProjection
    ? projection({ nowS, btC: input.btC, rorCPerMin: input.rorCPerMin, edgeS: window.toS })
    : [];
  return [
    ...(settings.chartPhaseBands
      ? [{ kind: 'phase-bands' as const, id: 'phase-bands', bands: phaseBands(input) }]
      : []),
    ...(ahead.length > 0
      ? [
          {
            kind: 'projection' as const,
            id: 'projection',
            axis: 'temperature' as const,
            tone: 'heat' as const,
            points: ahead.map((p) => ({ t: p.tS, v: p.c })),
          },
        ]
      : []),
    ...(settings.chartNowLine ? [{ kind: 'now-line' as const, id: 'now', t: nowS }] : []),
  ];
}

/** The coolest temperature drawn in the window: live, ghost, plan and projection. */
function lowestInView(
  lines: readonly LineLayer[],
  aids: readonly ChartAid[],
  window: TimeWindow,
): number | undefined {
  const drawn: readonly (readonly ChartPoint[])[] = [
    ...lines.filter((l) => l.axis === 'temperature').map((l) => l.points),
    ...aids.flatMap((aid) => (aid.kind === 'projection' ? [aid.points] : [])),
  ];
  let lowest: number | undefined;
  for (const points of drawn)
    for (const { t, v } of points)
      if (
        v !== null &&
        t >= window.fromS &&
        t <= window.toS &&
        (lowest === undefined || v < lowest)
      )
        lowest = v;
  return lowest;
}

/**
 * The fitted floor: set once at Start from the expected turning point, then straight down to fit
 * any drawn line in view that goes below it (docs/spec/ui.md, Temperature focus).
 */
function fittedFloorC(
  input: RoastViewInput,
  aids: readonly ChartAid[],
  window: TimeWindow,
): number {
  const floorC = input.previous?.floorC ?? startFloorC(input.expectedTpC);
  return nextFloorC(floorC, lowestInView(input.lines, aids, window));
}

/**
 * How the Roast chart frames the roast (docs/spec/ui.md, Focus on the roast and During a roast):
 * before Start everything since Preheat; from Start −0:30 to the expected end + 1:00, growing with
 * the clock; Start to Drop, the fitted temperature floor and the aids that are switched on.
 */
export function roastView(input: RoastViewInput): RoastView {
  const { roast, previous } = input;
  if (roast.chargedAtMs === null) return BEFORE_START;
  const nowS = input.nowS ?? 0;
  const timeWindow = focusWindow(previous?.window, { nowS, expectedEndS: input.expectedEndS });
  const roasting = roast.phase === 'roasting' || roast.phase === 'development';
  if (!roasting) {
    return {
      timeWindow,
      temperatureFloorC: 0,
      aids: [],
      held: { window: timeWindow, floorC: previous?.floorC ?? 0 },
    };
  }
  const aids = aidsOf(input, timeWindow, nowS);
  const floorC = fittedFloorC(input, aids, timeWindow);
  return {
    timeWindow,
    temperatureFloorC: input.settings.chartTemperatureFocus ? floorC : 0,
    aids,
    held: { window: timeWindow, floorC },
  };
}
