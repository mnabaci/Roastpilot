import type { RoastState } from '@roastpilot/shared';
import type { LineLayer, ChartMarker } from '@roastpilot/ui';
import { useMemo } from 'react';
import { useBeans } from '../../stores/use-stores';
import { useSavedRoast } from '../history/use-saved-roast';
import { formatGhostDelta, ghostChart, ghostDelta } from './ghost';

/**
 * The ghost picked in the setup: its faded layers once charged (before it, the chart's clock is
 * the preheat's), while roasting how today compares with it ("+3 °C vs ghost · 0:12 ahead"), and
 * when it dropped.
 */
export function useGhost(
  roast: RoastState,
  {
    elapsedS,
    bt,
    smoothingS,
  }: { elapsedS: number | undefined; bt: number | undefined; smoothingS: number },
): { layers: LineLayer[]; markers: ChartMarker[]; line?: string; dropS?: number } {
  const ghostId = useBeans((s) => s.setup.ghostRoastId);
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
  return {
    ...chart,
    ...(delta ? { line: formatGhostDelta(delta) } : {}),
    ...(dropS === undefined ? {} : { dropS }),
  };
}
