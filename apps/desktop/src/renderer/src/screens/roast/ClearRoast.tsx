import { Button, ConfirmDialog } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useToast } from '../../features/use-toast';
import { roastActionRefused } from './roast-action-failed';
import { clearReadings } from '../../stores/roast-store';
import { useBeans, useRoast } from '../../stores/use-stores';

/**
 * Clear: resets the whole view (stepper, numbers, chart). Needs no roaster, and shows only with a
 * roast (or a preheat) on screen, as idle readings keep coming while connected. After a finished
 * roast it asks whether the batch deducted at charge goes back to stock.
 */
export function ClearRoast() {
  const { api, stores, logger } = useDeps();
  const run = useRun();
  const toast = useToast();
  const roast = useRoast((s) => s.roast);
  const setup = useBeans((s) => s.setup);
  const beanName = useBeans((s) => s.beans.find((b) => b.id === setup.beanId)?.name);
  const [asking, setAsking] = useState(false);
  const roastOnScreen = roast.preheatAtMs !== null || roast.chargedAtMs !== null;
  if (!(roast.phase === 'ready' || roast.phase === 'done') || !roastOnScreen) return null;
  // Stock was deducted at charge, so only a finished roast has any to return.
  const { beanId, batchG } = setup;
  const deducted = roast.phase === 'done' && beanId !== null && batchG !== null;

  const clear = (returnStock: boolean) => {
    run(
      'roast.clear-failed',
      async () => {
        if (returnStock && beanId !== null && batchG !== null) {
          const returned = await api.adjustStock({ beanId, greenG: batchG, roastedG: 0 });
          // Keep the roast on screen, so Clear can be tried again or the stock kept deducted.
          if (!returned.ok) {
            logger.warn('roast.stock-return-failed', { beanId, batchG, error: returned.error });
            toast('error', "Couldn't return the beans to stock · try again");
            return;
          }
        }
        const cleared = await api.roastAction('clear');
        if (cleared.ok) {
          setAsking(false);
          stores.roast.setState(clearReadings);
          return;
        }
        logger.info('roast.action-refused', { ...cleared.error });
        toast('error', roastActionRefused('clear'));
      },
      { failed: "Couldn't clear the roast · try again" },
    );
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        // Its text on the step names' line, keeping the 44 px target without a taller row.
        className="-my-3 shrink-0"
        onClick={() => {
          if (deducted) setAsking(true);
          else clear(false);
        }}
      >
        Clear
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        // Clear only empties the screen: the saved roast stays, which "Clear this roast?" hid.
        question="Clear the screen?"
        detail={`The roast stays in History. Return ${String(batchG)} g of ${beanName ?? 'beans'} to stock too?`}
        confirmLabel="Return to stock"
        onConfirm={() => {
          clear(true);
        }}
        alternative={{
          label: 'Keep deducted',
          onSelect: () => {
            clear(false);
          },
        }}
      />
    </>
  );
}
