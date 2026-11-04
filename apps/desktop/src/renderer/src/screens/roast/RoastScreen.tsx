import { Button, PhaseStepper, RoastChart } from '@roastpilot/ui';
import type { RoastPhase } from '@roastpilot/shared';
import { useMemo } from 'react';
import { roastChartData } from './roast-chart-data';
import { roastNumbers } from './roast-numbers';
import { stageTimes } from './stage-times';
import { FlowPanel } from './FlowPanel';
import { OutputsPanel } from './OutputsPanel';
import { RoastNumbersRow } from './RoastNumbersRow';
import { useConnection, useRoast, useSettings } from '../../stores/use-stores';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { isConnected } from './flow-step';

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
  const { api } = useDeps();
  const run = useRun();
  const connected = useConnection((s) => isConnected(s.connection));
  const numbers = useMemo(() => roastNumbers(roast, readings), [roast, readings]);
  // With no roaster, the last temperature would look live: show dashes instead.
  const shown = connected ? numbers : { ...numbers, bt: undefined, ror: undefined };
  const canClear = (roast.phase === 'ready' || roast.phase === 'done') && readings.length > 0;
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const chart = useMemo(
    () => roastChartData(roast, readings, { smoothingS }),
    [roast, readings, smoothingS],
  );
  return (
    <main className="grid min-h-0 flex-1 grid-cols-[1fr_auto] content-start gap-6 overflow-y-auto p-6">
      <div className="flex min-w-0 flex-col gap-5">
        <PhaseStepper
          steps={STEPS}
          current={CURRENT_STEP[roast.phase]}
          details={stageTimes(roast)}
        />
        <RoastNumbersRow numbers={shown} />
        <RoastChart
          title="Roast curve"
          layers={chart.layers}
          markers={chart.markers}
          action={
            canClear ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  run('roast.clear-failed', () => api.roastAction('clear'));
                }}
              >
                Clear
              </Button>
            ) : undefined
          }
        />
      </div>
      <aside aria-label="Controls" className="flex w-80 flex-col gap-5">
        <FlowPanel coolingLeftS={numbers.coolingLeftS} onConnect={onConnect} />
        <OutputsPanel />
        <p className="text-label text-ink-muted">Stay with the roaster while it runs.</p>
      </aside>
    </main>
  );
}
