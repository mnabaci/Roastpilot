import {
  expectedRoastEndS,
  expectedTurningPointC,
  plannedDropS,
  plannedTurningPointC,
} from '@roastpilot/core';
import type { RoastState } from '@roastpilot/shared';
import type { LineLayer } from '@roastpilot/ui';
import { useMemo, useState } from 'react';
import { useRoastExpectations } from '../../features/use-roast-expectations';
import { useSettings } from '../../stores/use-stores';
import { useProfileInUse } from './use-active-profile';
import { roastView, type HeldView, type RoastView } from './roast-view';

/** What one roast's view keeps between readings. */
interface Held {
  chargedAtMs: number | null;
  view: HeldView;
}

/**
 * The Roast chart's frame and aids for this moment (`roastView`), from the profile in use, the
 * ghost, the saved roasts and Settings › Chart. `lines` are all the chart's lines, ghost too.
 */
export function useRoastView({
  roast,
  lines,
  rorCPerMin,
  ghost,
}: {
  roast: RoastState;
  lines: readonly LineLayer[];
  rorCPerMin: number | undefined;
  ghost: { dropS?: number; tpC?: number };
}): RoastView {
  const chartProjection = useSettings((s) => s.settings.chartProjection);
  const chartNowLine = useSettings((s) => s.settings.chartNowLine);
  const chartTemperatureFocus = useSettings((s) => s.settings.chartTemperatureFocus);
  const chartPhaseBands = useSettings((s) => s.settings.chartPhaseBands);
  const profile = useProfileInUse();
  const expected = useRoastExpectations();
  const [held, setHeld] = useState<Held>();
  const previous = held?.chargedAtMs === roast.chargedAtMs ? held.view : undefined;
  const latest = lines.find((l) => l.id === 'bt')?.points.findLast((p) => p.v !== null);
  const expectedEndS = expectedRoastEndS({
    plannedDropS: profile ? plannedDropS(profile) : undefined,
    ghostDropS: ghost.dropS,
  });
  const expectedTpC = expectedTurningPointC({
    ghostC: ghost.tpC,
    planC: profile ? plannedTurningPointC(profile) : undefined,
    savedC: expected.turningPointC,
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
        lines,
        expectedTpC,
        settings: { chartProjection, chartNowLine, chartTemperatureFocus, chartPhaseBands },
        profileDryEndC: profile?.dryEndC,
        expectedFirstCrackC: expected.firstCrackC,
      }),
    [
      roast,
      latest?.t,
      latest?.v,
      rorCPerMin,
      expectedEndS,
      previous,
      lines,
      expectedTpC,
      chartProjection,
      chartNowLine,
      chartTemperatureFocus,
      chartPhaseBands,
      profile?.dryEndC,
      expected.firstCrackC,
    ],
  );
  // Kept from this render on (React's "state from the previous render"): the window never
  // shrinks and the floor never rises during the roast.
  const next = view.held;
  if (
    next &&
    (next.window.toS !== previous?.window.toS ||
      next.floorC !== previous.floorC ||
      next.floorAtS !== previous.floorAtS)
  ) {
    setHeld({ chargedAtMs: roast.chargedAtMs, view: next });
  }
  return view;
}
