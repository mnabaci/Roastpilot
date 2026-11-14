import type { Roaster } from '@roastpilot/shared';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { without } from '../../stores/edits-store';
import { useEdits } from '../../stores/use-stores';
import { fromRoasterDraft, toRoasterDraft, type RoasterDraft } from './roaster-draft';
import { refusalText } from './roaster-refusal';

/**
 * A roaster's record as a draft: what Save sends and whether it can. An unsaved edit is kept in
 * the edits store, so leaving the page and coming back finds it (docs/spec/ui.md, Read and edit).
 * The page holds it, so its header's Cancel and Save act on the cards below.
 */
export function useRoasterDraft(roaster: Roaster) {
  const { api, logger, stores } = useDeps();
  const run = useRun();
  const unit = useTemperatureUnit();
  const saved = useMemo(() => toRoasterDraft(roaster, unit), [roaster, unit]);
  const kept = useEdits((s) => s.roasters[roaster.id]);
  const draft = useMemo(() => {
    if (!kept) return saved;
    if (kept.unit === unit) return kept.draft;
    // Typed in the other unit: read it back through the record, or keep it as typed.
    const back = fromRoasterDraft(kept.draft, roaster, kept.unit);
    return back.ok ? toRoasterDraft(back.value, unit) : kept.draft;
  }, [kept, saved, roaster, unit]);
  const forget = () => {
    stores.edits.setState((s) => ({ roasters: without(s.roasters, roaster.id) }));
  };
  const setDraft = (next: RoasterDraft) => {
    // An edit undone by hand is no edit.
    if (JSON.stringify(next) === JSON.stringify(saved)) forget();
    else
      stores.edits.setState((s) => ({
        roasters: { ...s.roasters, [roaster.id]: { draft: next, unit } },
      }));
  };
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
          forget();
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
    forget();
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
