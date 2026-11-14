import type { Roaster, SaveWiringError, Tc4Wiring } from '@roastpilot/shared';
import { modelFacts } from '@roastpilot/shared';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { connectErrorText } from './connect-error';

/** One line for a refused save: what happened and what to try. */
export function saveWiringRefusal(error: SaveWiringError, roaster: Roaster): string {
  if (error.kind === 'roasting') return 'Waits until the roast ends';
  if (error.kind === 'reconnect-failed') {
    return `Saved · ${connectErrorText(error.error, modelFacts(roaster.model))}`;
  }
  return "Couldn't save the wiring · see the log";
}

/** Saves a TC4's wiring as you pick (docs/spec/roasters.md, Generic TC4), one save at a time. */
export function useSaveWiring(roaster: Roaster) {
  const { api, logger } = useDeps();
  const run = useRun();
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string>();
  const save = (wiring: Tc4Wiring, minFanHeatingPct = roaster.minFanHeatingPct) => {
    setProblem(undefined);
    setSaving(true);
    run(
      'roasters.wiring-save-failed',
      async () => {
        try {
          const saved = await api.saveRoasterWiring({ id: roaster.id, wiring, minFanHeatingPct });
          if (saved.ok) return;
          // A failed reconnect still saved the wiring: not a refusal.
          logger.warn(
            saved.error.kind === 'reconnect-failed'
              ? 'roasters.wiring-reconnect-failed'
              : 'roasters.refused',
            { ...saved.error },
          );
          setProblem(saveWiringRefusal(saved.error, roaster));
        } finally {
          setSaving(false);
        }
      },
      { failed: "Couldn't save the wiring · try again" },
    );
  };
  return { save, saving, problem };
}
