import { expectedFirstCrackC, savedTurningPointC } from '@roastpilot/core';
import { useMemo } from 'react';
import { useRoastList } from '../screens/history/use-roast-list';
import { activeRoaster } from '../stores/roasters-store';
import { useRoasters } from '../stores/use-stores';

/** What the saved roasts say to expect, °C; each undefined without any roast that had it. */
export interface RoastExpectations {
  /** For the Listen for first crack sound and the phase bands (docs/spec/ui.md, Sounds). */
  firstCrackC: number | undefined;
  /** For the chart's fitted floor when there is no ghost or plan (docs/spec/ui.md, Chart). */
  turningPointC: number | undefined;
}

/** BT at first crack and at the turning point to expect, from the last saved roasts. */
export function useRoastExpectations(): RoastExpectations {
  const roasts = useRoastList();
  const roasterId = useRoasters((s) => activeRoaster(s.roasters)?.id);
  return useMemo(
    () => ({
      firstCrackC: roasts ? expectedFirstCrackC(roasts, roasterId) : undefined,
      turningPointC: roasts ? savedTurningPointC(roasts, roasterId) : undefined,
    }),
    [roasts, roasterId],
  );
}
