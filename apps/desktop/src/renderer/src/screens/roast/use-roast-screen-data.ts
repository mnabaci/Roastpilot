import { useMemo } from 'react';
import { roastChartData } from './roast-chart-data';
import { roastNumbers } from './roast-numbers';
import { useGhost } from './use-ghost';
import { useRunningPlan } from './use-active-profile';
import { usePlanLines } from './use-plan-lines';
import { useRoastView } from './use-roast-view';
import { isConnected } from './flow-step';
import { useOptionalSensor, useSensorNames } from '../../features/use-sensor-names';
import { useConnection, useRoast, useSettings } from '../../stores/use-stores';

/** What the Roast screen shows: the numbers, the chart's lines and markers, and its view. */
export function useRoastScreenData() {
  const roast = useRoast((s) => s.roast);
  const readings = useRoast((s) => s.readings);
  const connected = useConnection((s) => isConnected(s.connection));
  const lost = useConnection((s) => s.connection.status === 'lost');
  const numbers = useMemo(() => roastNumbers(roast, readings), [roast, readings]);
  // With no roaster, the last temperature would look live: show dashes instead.
  // ET needs no dash here: it only shows while the connected roaster has one (useOptionalSensor).
  const shown = connected ? numbers : { ...numbers, bt: undefined, ror: undefined };
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const temp = useSensorNames();
  // A string, so the chart below only works itself out again when the name changes.
  const etShort = useOptionalSensor('et')?.short;
  const plan = useRunningPlan();
  const chart = useMemo(
    () =>
      roastChartData(roast, readings, {
        smoothingS,
        tempName: temp.name,
        ...(etShort === undefined ? {} : { etShort }),
        plan,
      }),
    [roast, readings, smoothingS, temp.name, etShort, plan],
  );
  const ghost = useGhost(roast, { elapsedS: numbers.elapsedS, bt: shown.bt, smoothingS });
  const planLines = usePlanLines(shown.bt, numbers.elapsedS);
  // Ghost behind today's lines; one array, so the view only works itself out again on new lines.
  const lines = useMemo(() => [...ghost.layers, ...chart.layers], [ghost.layers, chart.layers]);
  const view = useRoastView({ roast, lines, rorCPerMin: shown.ror, ghost });
  // Kept between renders, so a render with no new reading doesn't redraw the chart.
  const layers = useMemo(() => [...lines, ...view.aids], [lines, view.aids]);
  const markers = useMemo(
    () => [...ghost.markers, ...chart.markers],
    [ghost.markers, chart.markers],
  );
  return {
    roast,
    heaterPct: readings.at(-1)?.values.heater,
    connected,
    // Connected, or lost and reconnecting: either way the outputs stay, with dashes while lost.
    hasRoaster: connected || lost,
    numbers,
    shown,
    tempName: temp.name,
    etShort,
    // In Auto the plan is what's followed, so it takes the ghost's place.
    tempLine: planLines.temp ?? ghost.line,
    rorLine: planLines.ror,
    layers,
    markers,
    view,
  };
}
