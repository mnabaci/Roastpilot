import type { RoastState } from '@roastpilot/shared';
import type { LineLayer, ChartMarker } from '@roastpilot/ui';
import { useMemo } from 'react';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { useBeans } from '../../stores/use-stores';
import { useSavedRoast } from '../history/use-saved-roast';
import { formatGhostDelta, ghostChart, ghostDelta } from './ghost';

/**
 * The ghost picked in the setup: its faded layers once charged (before it, the chart's clock is
 * the preheat's), while roasting how today compares with it ("+3 °C vs ghost · 0:12 ahead"), and
 * when it turned and dropped.
 */
export function useGhost(
  roast: RoastState,
  {
    elapsedS,
    bt,
    smoothingS,
  }: { elapsedS: number | undefined; bt: number | undefined; smoothingS: number },
): {
  layers: LineLayer[];
  markers: ChartMarker[];
  line?: string;
  dropS?: number;
  tpC?: number;
  /** A ghost is picked but not read yet: its drop and turning point are unknown, not none. */
  loading: boolean;
} {
  const ghostId = useBeans((s) => s.setup.ghostRoastId);
  const unit = useTemperatureUnit();
  const ghost = useSavedRoast(ghostId ?? undefined);
  const detail = ghost.status === 'loaded' ? ghost.detail : undefined;
  const charged = roast.chargedAtMs !== null;
  const chart = useMemo(
    () => (detail && charged ? ghostChart(detail, smoothingS) : { layers: [], markers: [] }),
    [detail, charged, smoothingS],
  );
  const roasting = roast.phase === 'roasting' || roast.phase === 'development';
  const delta =
    detail && roasting && bt !== undefined && elapsedS !== undefined
      ? ghostDelta(detail.samples, detail.dropTimeS, elapsedS, bt)
      : undefined;
  // When the ghost dropped: the roast's expected end when there is no profile.
  const dropS = detail?.dropTimeS ?? undefined;
  // Its turning point: where the chart's fitted floor starts from.
  const tpC = detail?.events.find((e) => e.kind === 'turning-point')?.bt ?? undefined;
  return {
    ...chart,
    loading: ghost.status === 'loading',
    ...(delta ? { line: formatGhostDelta(delta, unit) } : {}),
    ...(dropS === undefined ? {} : { dropS }),
    ...(tpC === undefined ? {} : { tpC }),
  };
}
