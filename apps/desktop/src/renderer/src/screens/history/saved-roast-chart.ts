import { plannedCurve, savedRoastWindow, type TimeWindow } from '@roastpilot/core';
import { READY_ROAST, type Reading, type RoastDetail, type RoastState } from '@roastpilot/shared';
import type { LineLayer, ChartMarker } from '@roastpilot/ui';
import { roastChartData } from '../roast/roast-chart-data';

/** A saved roast in the live roast's shape, with charge at 0, so the Roast screen's chart code draws it. */
export function savedAsLive(detail: RoastDetail): { roast: RoastState; readings: Reading[] } {
  const atMs = (tS: number) => Math.round(tS * 1000);
  const eventAt = (kind: RoastDetail['events'][number]['kind']) => {
    const event = detail.events.find((e) => e.kind === kind);
    return event ? atMs(event.tS) : null;
  };
  const first = detail.samples[0];
  return {
    roast: {
      ...READY_ROAST,
      phase: detail.endedAt === null ? 'cooling' : 'done',
      preheatAtMs: first && first.tS < 0 ? atMs(first.tS) : null,
      chargedAtMs: 0,
      firstCrackAtMs: eventAt('first-crack'),
      droppedAtMs: eventAt('drop'),
      events: detail.events.map((e) => ({ kind: e.kind, atMs: atMs(e.tS), bt: e.bt })),
    },
    readings: detail.samples.map((s) => ({ atMs: atMs(s.tS), values: s.values })),
  };
}

/**
 * The chart for a saved roast, with another roast's temperature behind it as a faded ghost line,
 * both aligned at charge (docs/spec/ui.md, History screen).
 */
export function savedRoastChart(
  detail: RoastDetail,
  compare: { detail: RoastDetail; label: string } | undefined,
  smoothingS: number,
): { layers: LineLayer[]; markers: ChartMarker[] } {
  const own = savedAsLive(detail);
  const chart = roastChartData(own.roast, own.readings, {
    smoothingS,
    ...(detail.profile ? { plan: plannedCurve(detail.profile) } : {}),
  });
  if (!compare) return chart;
  const other = savedAsLive(compare.detail);
  const otherBt = roastChartData(other.roast, other.readings, { smoothingS }).layers.find(
    (l) => l.id === 'bt',
  );
  if (!otherBt) return chart;
  const ghost: LineLayer = {
    ...otherBt,
    id: 'compare-bt',
    label: compare.label,
    tone: 'ghost',
    width: 2,
  };
  return { layers: [ghost, ...chart.layers], markers: chart.markers };
}

/** −0:30 to a saved roast's cool end (or Stop roast, or else drop) + 0:30; none without an end. */
function focusOf(detail: RoastDetail): TimeWindow | undefined {
  const endEvent = detail.events.find((e) => e.kind === 'cool-end' || e.kind === 'end');
  return savedRoastWindow({ coolEndS: endEvent?.tS, dropS: detail.dropTimeS ?? undefined });
}

/**
 * History's focused view of a saved roast: −0:30 to its cool end (or Stop roast, or else drop)
 * + 0:30, reaching the compared roast's end too, so a longer roast's crack and drop stay in view
 * (docs/spec/ui.md, History). Undefined when that would hide nothing: the roast has no end to
 * focus on, or no reading of either roast outside it, so Show preheat would change nothing.
 */
export function savedRoastFocus(
  detail: RoastDetail,
  compare?: RoastDetail,
): TimeWindow | undefined {
  const own = focusOf(detail);
  if (!own) return undefined;
  const other = compare ? focusOf(compare) : undefined;
  const focus = { fromS: own.fromS, toS: Math.max(own.toS, other?.toS ?? -Infinity) };
  const drawn = compare ? [detail, compare] : [detail];
  const outside = drawn.some((d) => d.samples.some((s) => s.tS < focus.fromS || s.tS > focus.toS));
  return outside ? focus : undefined;
}
