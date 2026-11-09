import type { Roaster } from '@roastpilot/shared';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { fromRoasterDraft, toRoasterDraft } from './roaster-draft';
import { refusalText } from './roaster-refusal';

/**
 * A roaster's record as a draft: what Save sends and whether it can. The page holds it, so its
 * header's Cancel and Save act on the form below.
 */
export function useRoasterDraft(roaster: Roaster) {
  const { api, logger } = useDeps();
  const run = useRun();
  const unit = useTemperatureUnit();
  const saved = useMemo(() => toRoasterDraft(roaster, unit), [roaster, unit]);
  const [draft, setDraft] = useState(saved);
  const [problem, setProblem] = useState<string>();
  const checked = useMemo(() => fromRoasterDraft(draft, roaster, unit), [draft, roaster, unit]);
  const errors = checked.ok ? {} : checked.error;
  const edited = JSON.stringify(draft) !== JSON.stringify(saved);
  const save = (onSaved: () => void) => {
    if (!checked.ok) return;
    run(
      'roasters.save-failed',
      async () => {
        const result = await api.saveRoaster(checked.value);
        if (result.ok) {
          setProblem(undefined);
          onSaved();
          return;
        }
        logger.warn('roasters.refused', { ...result.error });
        setProblem(refusalText(result.error, 'save'));
      },
      { failed: "Couldn't save the roaster · try again" },
    );
  };
  const cancel = () => {
    setDraft(saved);
    setProblem(undefined);
  };
  return {
    draft,
    setDraft,
    errors,
    edited,
    canSave: edited && checked.ok,
    save,
    cancel,
    problem,
    unit,
  };
}

export type RoasterDraftState = ReturnType<typeof useRoasterDraft>;
