import { PhaseStepper, RoastChart } from '@roastpilot/ui';
import type { RoastPhase } from '@roastpilot/shared';
import { useMemo } from 'react';
import { roastChartData } from './roast-chart-data';
import { roastNumbers } from './roast-numbers';
import { skippedSteps, stageTimes } from './stage-times';
import { useGhost } from './use-ghost';
import { RoastSetupPanel } from './RoastSetupPanel';
import { FlowPanel } from './FlowPanel';
import { FinishedRoastCard } from './FinishedRoastCard';
import { useRunningPlan } from './use-active-profile';
import { usePlanLines } from './use-plan-lines';
import { useRoastView } from './use-roast-view';
import { OutputsPanel } from './OutputsPanel';
import { CoachPanel } from './CoachPanel';
import { RoastNumbersRow } from './RoastNumbersRow';
import { useOptionalSensor, useSensorNames } from '../../features/use-sensor-names';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { useConnection, useRoast, useSettings } from '../../stores/use-stores';
import { isConnected } from './flow-step';
import { ClearRoast } from './ClearRoast';
import { StayClose } from './StayClose';

const STEPS = ['Preheat', 'Roast', 'First crack', 'Drop', 'Cool'] as const;

/** Which step is current; Ready has none yet, Done has them all done. */
const CURRENT_STEP: Readonly<Record<RoastPhase, number>> = {
  ready: -1,
  preheat: 0,
  roasting: 1,
  development: 2,
  cooling: 4,
  done: STEPS.length,
};

/** The manual roast (docs/spec/ui.md, Roast screen, milestone 2). */
export function RoastScreen({ onConnect }: { onConnect: () => void }) {
  const roast = useRoast((s) => s.roast);
  const readings = useRoast((s) => s.readings);
  const connected = useConnection((s) => isConnected(s.connection));
  const lost = useConnection((s) => s.connection.status === 'lost');
  const numbers = useMemo(() => roastNumbers(roast, readings), [roast, readings]);
  // With no roaster, the last temperature would look live: show dashes instead.
  const shown = connected ? numbers : { ...numbers, bt: undefined, et: undefined, ror: undefined };
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const unit = useTemperatureUnit();
  const temp = useSensorNames();
  const et = useOptionalSensor('et');
  const plan = useRunningPlan();
  const chart = useMemo(
    () =>
      roastChartData(roast, readings, {
        smoothingS,
        tempName: temp.name,
        ...(et ? { etName: et.short } : {}),
        plan,
      }),
    [roast, readings, smoothingS, temp.name, et, plan],
  );
  const ghost = useGhost(roast, { elapsedS: numbers.elapsedS, bt: shown.bt, smoothingS });
  const planLines = usePlanLines(shown.bt, numbers.elapsedS);
  // Ghost behind today's lines; one array, so the view only works itself out again on new lines.
  const lines = useMemo(() => [...ghost.layers, ...chart.layers], [ghost.layers, chart.layers]);
  const view = useRoastView({
    roast,
    lines,
    rorCPerMin: shown.ror,
    ghost,
  });
  // Kept between renders, so a render with no new reading doesn't redraw the chart.
  const layers = useMemo(() => [...lines, ...view.aids], [lines, view.aids]);
  const markers = useMemo(
    () => [...ghost.markers, ...chart.markers],
    [ghost.markers, chart.markers],
  );
  // Connected, or lost and reconnecting: either way the outputs stay, with dashes while lost.
  const hasRoaster = connected || lost;
  const idle = roast.phase === 'ready' || roast.phase === 'done';
  const flow = (
    <FlowPanel
      coolingLeftS={numbers.coolingLeftS}
      developmentS={numbers.developmentS}
      heaterPct={readings.at(-1)?.values.heater}
      onConnect={onConnect}
    />
  );
  // A new key when a roast starts or ends, so a half-open Change never carries across.
  const setupPanel = <RoastSetupPanel key={idle ? 'idle' : 'roasting'} />;
  return (
    // The two columns scroll on their own, so the action and sliders never leave with the chart.
    <main className="grid min-h-0 flex-1 grid-cols-[1fr_auto] gap-6 overflow-hidden p-6">
      <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <PhaseStepper
            steps={STEPS}
            current={CURRENT_STEP[roast.phase]}
            details={stageTimes(roast)}
            skipped={skippedSteps(roast)}
          />
          <ClearRoast />
        </div>
        <RoastNumbersRow
          numbers={shown}
          tempName={temp.name}
          etShort={et?.short}
          // In Auto the plan is what's followed, so it takes the ghost's place.
          tempLine={planLines.temp ?? ghost.line}
          rorLine={planLines.ror}
        />
        <FinishedRoastCard />
        <RoastChart
          title="Roast curve"
          layers={layers}
          markers={markers}
          timeWindow={view.timeWindow}
          temperatureFloorC={view.temperatureFloorC}
          temperatureUnit={unit}
          // Preheat to Cooling, the legends say the latest values; never stale ones off a roaster.
          showLatest={connected && !idle}
        />
      </div>
      {/* The panel shows what the moment needs (docs/spec/ui.md, Side panel follows the roast). */}
      {/* Relative, so a screen-reader-only label low in the panel never stretches the page. */}
      <aside
        aria-label="Controls"
        className="relative flex min-h-0 w-80 flex-col gap-4 overflow-y-auto"
      >
        {!hasRoaster ? (
          <>
            {flow}
            {setupPanel}
          </>
        ) : roast.phase === 'ready' ? (
          // Before a roast you fill the setup in, so it leads.
          <>
            {setupPanel}
            {flow}
            <OutputsPanel />
          </>
        ) : (
          // During and after a roast the controls come right under the action.
          <>
            {flow}
            <CoachPanel />
            <OutputsPanel />
            {setupPanel}
            {roast.phase === 'done' ? null : <StayClose />}
          </>
        )}
      </aside>
    </main>
  );
}
