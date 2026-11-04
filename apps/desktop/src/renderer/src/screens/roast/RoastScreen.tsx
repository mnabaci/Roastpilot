import { Button, PhaseStepper, RoastChart } from '@roastpilot/ui';
import type { RoastPhase } from '@roastpilot/shared';
import { useMemo } from 'react';
import { roastChartData } from './roast-chart-data';
import { roastNumbers } from './roast-numbers';
import { skippedSteps, stageTimes } from './stage-times';
import { FlowPanel } from './FlowPanel';
import { OutputsPanel } from './OutputsPanel';
import { RoastNumbersRow } from './RoastNumbersRow';
import { useSensorNames } from '../../features/use-sensor-names';
import { clearReadings } from '../../stores/roast-store';
import { useConnection, useRoast, useSettings } from '../../stores/use-stores';
import { isConnected } from './flow-step';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';

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
  const { api, stores } = useDeps();
  const run = useRun();
  const connected = useConnection((s) => isConnected(s.connection));
  // Clear resets the whole view (stepper, numbers, chart), so it sits above them. Needs no roaster.
  // Only with a roast (or a preheat) on screen: idle readings keep coming while connected.
  const roastOnScreen = roast.preheatAtMs !== null || roast.chargedAtMs !== null;
  const canClear = (roast.phase === 'ready' || roast.phase === 'done') && roastOnScreen;
  const numbers = useMemo(() => roastNumbers(roast, readings), [roast, readings]);
  // With no roaster, the last temperature would look live: show dashes instead.
  const shown = connected ? numbers : { ...numbers, bt: undefined, ror: undefined };
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const temp = useSensorNames();
  const chart = useMemo(
    () => roastChartData(roast, readings, { smoothingS, tempName: temp.name }),
    [roast, readings, smoothingS, temp.name],
  );
  return (
    <main className="grid min-h-0 flex-1 grid-cols-[1fr_auto] content-start gap-6 overflow-y-auto p-6">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <PhaseStepper
            steps={STEPS}
            current={CURRENT_STEP[roast.phase]}
            details={stageTimes(roast)}
            skipped={skippedSteps(roast)}
          />
          {canClear ? (
            <Button
              variant="ghost"
              size="sm"
              // Its text on the step names' line, keeping the 44 px target without a taller row.
              className="-my-3 shrink-0"
              onClick={() => {
                run('roast.clear-failed', async () => {
                  const cleared = await api.roastAction('clear');
                  if (cleared.ok) stores.roast.setState(clearReadings);
                });
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <RoastNumbersRow numbers={shown} tempName={temp.name} />
        <RoastChart title="Roast curve" layers={chart.layers} markers={chart.markers} />
      </div>
      <aside aria-label="Controls" className="flex w-80 flex-col gap-5">
        <FlowPanel coolingLeftS={numbers.coolingLeftS} onConnect={onConnect} />
        <OutputsPanel />
        <p className="text-label text-ink-muted">Stay with the roaster while it runs.</p>
      </aside>
    </main>
  );
}
