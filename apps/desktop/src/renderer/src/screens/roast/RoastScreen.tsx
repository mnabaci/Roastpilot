import { PhaseStepper, RoastChart } from '@roastpilot/ui';
import type { RoastPhase } from '@roastpilot/shared';
import { skippedSteps, stageTimes } from './stage-times';
import { FlowPanel } from './FlowPanel';
import { FinishedRoastCard } from './FinishedRoastCard';
import { RoastNumbersRow } from './RoastNumbersRow';
import { RoastControls } from './RoastControls';
import { useRoastScreenData } from './use-roast-screen-data';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { ClearRoast } from './ClearRoast';

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
  const data = useRoastScreenData();
  const { roast, numbers, view } = data;
  const unit = useTemperatureUnit();
  const idle = roast.phase === 'ready' || roast.phase === 'done';
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
          numbers={data.shown}
          tempName={data.tempName}
          etShort={data.etShort}
          tempLine={data.tempLine}
          rorLine={data.rorLine}
        />
        <FinishedRoastCard />
        <RoastChart
          title="Roast curve"
          layers={data.layers}
          markers={data.markers}
          timeWindow={view.timeWindow}
          temperatureFloorC={view.temperatureFloorC}
          temperatureUnit={unit}
          // Preheat to Cooling, the legends say the latest values; never stale ones off a roaster.
          showLatest={data.connected && !idle}
        />
      </div>
      <RoastControls
        phase={roast.phase}
        hasRoaster={data.hasRoaster}
        flow={
          <FlowPanel
            coolingLeftS={numbers.coolingLeftS}
            developmentS={numbers.developmentS}
            heaterPct={data.heaterPct}
            onConnect={onConnect}
          />
        }
      />
    </main>
  );
}
