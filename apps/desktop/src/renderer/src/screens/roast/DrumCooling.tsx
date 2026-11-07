import { ROASTER_COOL_OFFER_ABOVE_C } from '@roastpilot/core';
import type { RoastAction } from '@roastpilot/shared';
import { Button, formatNumber } from '@roastpilot/ui';
import { useRoast, useSettings } from '../../stores/use-stores';

/**
 * Drum cooling in Ready and Done (docs/spec/manual-mode.md): progress with a quiet Stop while it
 * runs, otherwise Cool the drum while it is hot.
 */
export function DrumCooling({ onAction }: { onAction: (action: RoastAction) => void }) {
  const runningToC = useRoast((s) => s.roast.roasterCoolToC);
  const bt = useRoast((s) => s.readings.at(-1)?.values.bt);
  const toC = useSettings((s) => s.settings.roasterCoolToC);
  if (runningToC !== null) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p role="status" className="text-label text-ink-muted">
          Cooling the drum · {formatNumber(bt, 0) ?? '–'} °C → {runningToC} °C
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
  if (bt === undefined || bt < toC + ROASTER_COOL_OFFER_ABOVE_C) return null;
  return (
    <Button
      onClick={() => {
        onAction('cool-roaster');
      }}
    >
      Cool the drum
    </Button>
  );
}
