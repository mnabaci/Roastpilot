import { expectedFirstCrackC } from '@roastpilot/core';
import { useMemo } from 'react';
import { useRoastList } from '../screens/history/use-roast-list';
import { activeRoaster } from '../stores/roasters-store';
import { useRoasters } from '../stores/use-stores';

/**
 * BT at first crack to expect from the saved roasts, as the Listen for first crack sound and the
 * phase bands read it (docs/spec/ui.md, Sounds); undefined without any.
 */
export function useExpectedFirstCrack(): number | undefined {
  const roasts = useRoastList();
  const roasterId = useRoasters((s) => activeRoaster(s.roasters)?.id);
  return useMemo(
    () => (roasts ? expectedFirstCrackC(roasts, roasterId) : undefined),
    [roasts, roasterId],
  );
}
