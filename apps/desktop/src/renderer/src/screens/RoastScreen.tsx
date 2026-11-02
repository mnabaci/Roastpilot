import { PhaseStepper, RoastChart } from '@roastpilot/ui';
import type { RoastPhase } from '@roastpilot/shared';
import { useMemo } from 'react';
import { roastChartData } from '../lib/roast-chart-data';
import { roastNumbers } from '../lib/roast-numbers';
import { FlowPanel } from '../roast/FlowPanel';
import { OutputsPanel } from '../roast/OutputsPanel';
import { RoastNumbersRow } from '../roast/RoastNumbersRow';
import { useAppState } from '../state/app-context';

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
  const roast = useAppState((s) => s.roast);
  const readings = useAppState((s) => s.readings);
  const numbers = useMemo(() => roastNumbers(roast, readings), [roast, readings]);
  const chart = useMemo(() => roastChartData(roast, readings), [roast, readings]);
  return (
    <main className="grid flex-1 grid-cols-[1fr_auto] gap-6 p-6">
      <div className="flex min-w-0 flex-col gap-5">
        <PhaseStepper steps={STEPS} current={CURRENT_STEP[roast.phase]} />
        <RoastNumbersRow numbers={numbers} />
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
