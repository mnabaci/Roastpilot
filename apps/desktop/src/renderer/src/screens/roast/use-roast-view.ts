import { expectedRoastEndS, plannedDropS, type TimeWindow } from '@roastpilot/core';
import type { RoastState } from '@roastpilot/shared';
import type { LineLayer } from '@roastpilot/ui';
import { useMemo, useState } from 'react';
import { useExpectedFirstCrack } from '../../features/use-expected-first-crack';
import { useSettings } from '../../stores/use-stores';
import { useProfileInUse } from './use-active-profile';
import { roastView, type RoastView } from './roast-view';

/** The window shown for one roast, kept so it never comes back in. */
interface HeldWindow {
  chargedAtMs: number | null;
  window: TimeWindow;
}

/**
 * The Roast chart's frame and aids for this moment (`roastView`), from the profile in use, the
 * ghost, the saved roasts' first cracks and Settings › Chart.
 */
export function useRoastView({
  roast,
  lines,
  rorCPerMin,
  ghostDropS,
}: {
  roast: RoastState;
  lines: readonly LineLayer[];
  rorCPerMin: number | undefined;
  ghostDropS: number | undefined;
}): RoastView {
  const chartProjection = useSettings((s) => s.settings.chartProjection);
  const chartNowLine = useSettings((s) => s.settings.chartNowLine);
  const chartTemperatureFocus = useSettings((s) => s.settings.chartTemperatureFocus);
  const chartPhaseBands = useSettings((s) => s.settings.chartPhaseBands);
  const profile = useProfileInUse();
  const expectedFirstCrackC = useExpectedFirstCrack();
  const [held, setHeld] = useState<HeldWindow>();
  const previous = held?.chargedAtMs === roast.chargedAtMs ? held.window : undefined;
  const latest = lines.find((l) => l.id === 'bt')?.points.findLast((p) => p.v !== null);
  const expectedEndS = expectedRoastEndS({
    plannedDropS: profile ? plannedDropS(profile) : undefined,
    ghostDropS,
  });
  const view = useMemo(
    () =>
      roastView({
        roast,
        nowS: latest?.t,
        btC: latest?.v ?? undefined,
        rorCPerMin,
        expectedEndS,
        previous,
        settings: { chartProjection, chartNowLine, chartTemperatureFocus, chartPhaseBands },
        profileDryEndC: profile?.dryEndC,
        expectedFirstCrackC,
      }),
    [
      roast,
      latest?.t,
      latest?.v,
      rorCPerMin,
      expectedEndS,
      previous,
      chartProjection,
      chartNowLine,
      chartTemperatureFocus,
      chartPhaseBands,
      profile?.dryEndC,
      expectedFirstCrackC,
    ],
  );
  // Remembered from this render on (React's "state from the previous render"), so it never shrinks.
  if (view.timeWindow && view.timeWindow.toS !== previous?.toS) {
    setHeld({ chargedAtMs: roast.chargedAtMs, window: view.timeWindow });
  }
  return view;
}
