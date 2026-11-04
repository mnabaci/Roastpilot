import { ROASTER_COOL_C, ROASTER_COOL_OFFER_C } from '@roastpilot/core';
import type { RoastAction } from '@roastpilot/shared';
import { Button, formatNumber } from '@roastpilot/ui';
import { useRoast } from '../../stores/use-stores';

/**
 * Roaster cool-down in Ready and Done (docs/spec/manual-mode.md): progress with a quiet Stop while
 * it runs, otherwise Cool down roaster while the drum is hot.
 */
export function RoasterCooling({ onAction }: { onAction: (action: RoastAction) => void }) {
  const running = useRoast((s) => s.roast.roasterCoolingSinceMs !== null);
  const bt = useRoast((s) => s.readings.at(-1)?.values.bt);
  if (running) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p role="status" className="text-label text-ink-muted">
          Cooling the roaster · {formatNumber(bt, 0) ?? '–'} °C → {ROASTER_COOL_C} °C
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onAction('stop-cooling-roaster');
          }}
        >
          Stop
        </Button>
      </div>
    );
  }
  if (bt === undefined || bt < ROASTER_COOL_OFFER_C) return null;
  return (
    <Button
      onClick={() => {
        onAction('cool-roaster');
      }}
    >
      Cool down roaster
    </Button>
  );
}
