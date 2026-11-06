import { Button, ConfirmDialog, PhaseStepper, RoastChart } from '@roastpilot/ui';
import type { RoastPhase } from '@roastpilot/shared';
import { useMemo, useState } from 'react';
import { roastChartData } from './roast-chart-data';
import { roastNumbers } from './roast-numbers';
import { skippedSteps, stageTimes } from './stage-times';
import { formatGhostDelta, ghostChart, ghostDelta } from './ghost';
import { RoastSetupPanel } from './RoastSetupPanel';
import { FlowPanel } from './FlowPanel';
import { FinishedRoastCard } from './FinishedRoastCard';
import { useRunningPlan } from './use-active-profile';
import { OutputsPanel } from './OutputsPanel';
import { RoastNumbersRow } from './RoastNumbersRow';
import { useSensorNames } from '../../features/use-sensor-names';
import { clearReadings } from '../../stores/roast-store';
import { useBeans, useConnection, useRoast, useSettings } from '../../stores/use-stores';
import { useSavedRoast } from '../history/use-saved-roast';
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
  const lost = useConnection((s) => s.connection.status === 'lost');
  // Clear resets the whole view (stepper, numbers, chart), so it sits above them. Needs no roaster.
  // Only with a roast (or a preheat) on screen: idle readings keep coming while connected.
  const roastOnScreen = roast.preheatAtMs !== null || roast.chargedAtMs !== null;
  const canClear = (roast.phase === 'ready' || roast.phase === 'done') && roastOnScreen;
  const numbers = useMemo(() => roastNumbers(roast, readings), [roast, readings]);
  // With no roaster, the last temperature would look live: show dashes instead.
  const shown = connected ? numbers : { ...numbers, bt: undefined, ror: undefined };
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const temp = useSensorNames();
  const plan = useRunningPlan();
  const chart = useMemo(
    () => roastChartData(roast, readings, { smoothingS, tempName: temp.name, plan }),
    [roast, readings, smoothingS, temp.name, plan],
  );
  const setup = useBeans((s) => s.setup);
  const beans = useBeans((s) => s.beans);
  // Stock was deducted at charge; ask whether to return it when clearing a completed roast.
  const deductedBeanId = roast.phase === 'done' ? setup.beanId : null;
  const deductedBatchG = roast.phase === 'done' ? setup.batchG : null;
  const hasDeductedStock = deductedBeanId !== null && deductedBatchG !== null;
  const deductedBeanName =
    deductedBeanId !== null
      ? (beans.find((b) => b.id === deductedBeanId)?.name ?? 'beans')
      : 'beans';
  const [awaitingStockReturn, setAwaitingStockReturn] = useState(false);

  const clearRoast = (returnStock: boolean) => {
    run('roast.clear-failed', async () => {
      if (returnStock && deductedBeanId !== null && deductedBatchG !== null) {
        await api.adjustStock({ beanId: deductedBeanId, greenG: deductedBatchG, roastedG: 0 });
      }
      const cleared = await api.roastAction('clear');
      if (cleared.ok) {
        setAwaitingStockReturn(false);
        stores.roast.setState(clearReadings);
      }
    });
  };

  // The ghost starts at charge: before it, the chart's clock is the preheat's.
  const ghostId = useBeans((s) => s.setup.ghostRoastId);
  const ghost = useSavedRoast(ghostId ?? undefined);
  const ghostDetail = ghost.status === 'loaded' ? ghost.detail : undefined;
  const charged = roast.chargedAtMs !== null;
  const ghostLayers = useMemo(
    () => (ghostDetail && charged ? ghostChart(ghostDetail, smoothingS) : undefined),
    [ghostDetail, charged, smoothingS],
  );
  const roasting = roast.phase === 'roasting' || roast.phase === 'development';
  const delta =
    ghostDetail && roasting && shown.bt !== undefined && numbers.elapsedS !== undefined
      ? ghostDelta(ghostDetail.samples, ghostDetail.dropTimeS, numbers.elapsedS, shown.bt)
      : undefined;
  // Connected, or lost and reconnecting: either way the outputs stay, with dashes while lost.
  const hasRoaster = connected || lost;
  const idle = roast.phase === 'ready' || roast.phase === 'done';
  const flow = <FlowPanel coolingLeftS={numbers.coolingLeftS} onConnect={onConnect} />;
  // A new key when a roast starts or ends, so a half-open Change never carries across.
  const setupPanel = <RoastSetupPanel key={idle ? 'idle' : 'roasting'} />;
  return (
    // The two columns scroll on their own, so the action and sliders never leave with the chart.
    <main className="grid min-h-0 flex-1 grid-cols-[1fr_auto] gap-6 overflow-hidden p-6">
      <div className="flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto">
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
                if (hasDeductedStock) {
                  setAwaitingStockReturn(true);
                } else {
                  run('roast.clear-failed', async () => {
                    const cleared = await api.roastAction('clear');
                    if (cleared.ok) stores.roast.setState(clearReadings);
                  });
                }
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <ConfirmDialog
          open={canClear && awaitingStockReturn}
          onOpenChange={setAwaitingStockReturn}
          question="Clear this roast?"
          detail={`Return ${String(deductedBatchG)} g of ${deductedBeanName} to stock?`}
          confirmLabel="Return to stock"
          onConfirm={() => {
            clearRoast(true);
          }}
          alternative={{
            label: 'Keep deducted',
            onSelect: () => {
              clearRoast(false);
            },
          }}
        />
        <RoastNumbersRow
          numbers={shown}
          tempName={temp.name}
          {...(delta ? { ghostLine: formatGhostDelta(delta) } : {})}
        />
        <FinishedRoastCard />
        <RoastChart
          title="Roast curve"
          layers={[...(ghostLayers?.layers ?? []), ...chart.layers]}
          markers={[...(ghostLayers?.markers ?? []), ...chart.markers]}
        />
      </div>
      {/* The panel shows what the moment needs (docs/spec/ui.md, Side panel follows the roast). */}
      <aside aria-label="Controls" className="flex min-h-0 w-80 flex-col gap-5 overflow-y-auto">
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
            <OutputsPanel />
            {setupPanel}
            {roast.phase === 'done' ? null : (
              <p className="text-label text-ink-muted">Stay with the roaster while it runs.</p>
            )}
          </>
        )}
      </aside>
    </main>
  );
}
