import {
  expectedRoastEndS,
  expectedTurningPointC,
  plannedDropS,
  plannedTurningPointC,
} from '@roastpilot/core';
import type { RoastState } from '@roastpilot/shared';
import type { LineLayer } from '@roastpilot/ui';
import { useEffect, useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRoastExpectations } from '../../features/use-roast-expectations';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { useSettings } from '../../stores/use-stores';
import { useProfileInUse } from './use-active-profile';
import { drawnRorCPerMin, roastView, type RoastView } from './roast-view';

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
  ghost: { dropS?: number; tpC?: number; loading?: boolean };
}): RoastView {
  const chartProjection = useSettings((s) => s.settings.chartProjection);
  const chartNowLine = useSettings((s) => s.settings.chartNowLine);
  const chartTemperatureFocus = useSettings((s) => s.settings.chartTemperatureFocus);
  const chartPhaseBands = useSettings((s) => s.settings.chartPhaseBands);
  const unit = useTemperatureUnit();
  const profile = useProfileInUse();
  const expected = useRoastExpectations();
  const { stores } = useDeps();
  // From the app's store on mount, so a visit to another screen mid-roast changes nothing.
  const [held, setHeld] = useState(() => stores.roastView.getState().held);
  useEffect(() => {
    stores.roastView.setState({ held });
  }, [held, stores.roastView]);
  const previous = held?.chargedAtMs === roast.chargedAtMs ? held.view : undefined;
  const latest = lines.find((l) => l.id === 'bt')?.points.findLast((p) => p.v !== null);
  // The projection follows the RoR line as drawn, and none while the RoR number is unknown.
  const drawnRor = rorCPerMin === undefined ? undefined : drawnRorCPerMin(lines);
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
        rorCPerMin: drawnRor,
        expectedEndS,
        previous,
        lines,
        expectedTpC,
        settings: { chartProjection, chartNowLine, chartTemperatureFocus, chartPhaseBands },
        unit,
        profileDryEndC: profile?.dryEndC,
        expectedFirstCrackC: expected.firstCrackC,
      }),
    [
      roast,
      latest?.t,
      latest?.v,
      drawnRor,
      expectedEndS,
      previous,
      lines,
      expectedTpC,
      chartProjection,
      chartNowLine,
      chartTemperatureFocus,
      chartPhaseBands,
      unit,
      profile?.dryEndC,
      expected.firstCrackC,
    ],
  );
  // Kept from this render on (React's "state from the previous render"): the window never
  // shrinks and the floor never rises during the roast.
  const next = view.held;
  // Held only once the ghost and saved roasts it starts from have loaded (after a reload
  // mid-roast), so a floor set from a turning point not known yet is never kept.
  const ready = expected.loaded && ghost.loading !== true;
  const changed = next?.window.toS !== previous?.window.toS || next?.floorC !== previous?.floorC;
  if (next && (previous !== undefined || ready) && changed) {
    setHeld({ chargedAtMs: roast.chargedAtMs, view: next });
  }
  return view;
}
