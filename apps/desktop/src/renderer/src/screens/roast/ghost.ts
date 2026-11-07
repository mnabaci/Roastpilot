import type { RoastDetail, RoastSummary, SavedSample } from '@roastpilot/shared';
import { formatClock, type ChartLayer, type ChartMarker } from '@roastpilot/ui';
import { roastTitle } from '../history/history-format';
import { savedAsLive } from '../history/saved-roast-chart';
import { roastChartData } from './roast-chart-data';

const GHOST_MARKERS: Partial<Record<RoastDetail['events'][number]['kind'], string>> = {
  'dry-end': 'Ghost dry end',
  'first-crack': 'Ghost FC',
  drop: 'Ghost drop',
};

/** A saved roast behind today's: faded temperature, RoR and markers, from charge on. */
export function ghostChart(
  detail: RoastDetail,
  smoothingS: number,
): { layers: ChartLayer[]; markers: ChartMarker[] } {
  const { roast, readings } = savedAsLive(detail);
  const { layers } = roastChartData(roast, readings, { smoothingS });
  const fade = (id: string, label: string, width: number): ChartLayer[] => {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return [];
    const points = layer.points.filter((p) => p.t >= 0);
    return [{ ...layer, id: `ghost-${id}`, label, tone: 'ghost', width, points }];
  };
  return {
    layers: [...fade('bt', 'Ghost', 2), ...fade('ror', 'Ghost RoR', 1.5)],
    markers: detail.events.flatMap((event) => {
      const label = GHOST_MARKERS[event.kind];
      return label
        ? [{ id: `ghost-${event.kind}`, label, t: event.tS, tone: 'ghost' as const }]
        : [];
    }),
  };
}

interface GhostPoint {
  tS: number;
  bt: number;
}

/** Charge to drop: cooling isn't part of the comparison. */
const runOf = (samples: readonly SavedSample[], dropS: number | null): GhostPoint[] =>
  samples.flatMap(({ tS, values }) => {
    const bt = values.bt;
    return tS >= 0 && tS <= (dropS ?? Infinity) && bt !== undefined ? [{ tS, bt }] : [];
  });

const between = (a: GhostPoint, b: GhostPoint, tS: number) =>
  a.bt + ((b.bt - a.bt) * (tS - a.tS)) / (b.tS - a.tS || 1);

export interface GhostDelta {
  /** Today minus the ghost at this time, °C. */
  deltaC: number;
  /** Positive: today reached this temperature that many seconds before the ghost did. */
  aheadS: number | undefined;
}

/** How today compares with the ghost (docs/spec/beans-favourites-ghost.md, Ghost layer). */
export function ghostDelta(
  samples: readonly SavedSample[],
  dropS: number | null,
  elapsedS: number,
  bt: number,
): GhostDelta | undefined {
  const run = runOf(samples, dropS);
  const after = run.findIndex((p) => p.tS >= elapsedS);
  const [first, second] = [run[after - 1], run[after]];
  if (!first || !second) return undefined;
  // After the turning point, as the dip at charge crosses the same temperatures on the way down.
  const lowest = run.reduce((low, p, i) => (p.bt < (run[low]?.bt ?? Infinity) ? i : low), 0);
  const climb = run.slice(lowest);
  const reached = climb.findIndex((p) => p.bt >= bt);
  const [below, above] = [climb[reached - 1], climb[reached]];
  const reachedS =
    below && above
      ? below.tS + ((bt - below.bt) / (above.bt - below.bt || 1)) * (above.tS - below.tS)
      : undefined;
  return {
    deltaC: bt - between(first, second, elapsedS),
    aheadS: reachedS === undefined ? undefined : reachedS - elapsedS,
  };
}

/** `+3 °C vs ghost · 0:12 ahead`. */
export function formatGhostDelta({ deltaC, aheadS }: GhostDelta): string {
  const rounded = Math.round(deltaC);
  const temp = `${rounded > 0 ? '+' : ''}${String(rounded)} °C vs ghost`;
  if (aheadS === undefined) return temp;
  const seconds = Math.round(aheadS);
  if (seconds === 0) return `${temp} · level`;
  return `${temp} · ${formatClock(Math.abs(seconds))} ${seconds > 0 ? 'ahead' : 'behind'}`;
}

/** What helps you pick a ghost: its bean, stars and first crack ("Ethiopia Guji · ★★★★★ · FC 9:12"). */
export function ghostDetail(roast: RoastSummary, beanName: string | undefined): string | undefined {
  const parts = [
    beanName,
    roast.rating === null ? undefined : '★'.repeat(roast.rating),
    roast.fcTimeS === null ? undefined : `FC ${formatClock(roast.fcTimeS)}`,
  ].filter((part) => part !== undefined);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** A saved roast as the ghost picker and the setup line name it: date and time, starred if a favourite. */
export const ghostLabel = (roast: RoastSummary): string =>
  `${roast.isFavourite ? '★ ' : ''}${roastTitle(roast.startedAt)}`;
