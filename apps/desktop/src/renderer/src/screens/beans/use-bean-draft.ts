import type { Bean, BeanId } from '@roastpilot/shared';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { without } from '../../stores/edits-store';
import { useEdits } from '../../stores/use-stores';
import { fromBeanDraft, toBeanDraft, type BeanDraft } from './bean-draft';

/** Where a bean being added keeps its draft. */
export const NEW_BEAN = 'new';

/**
 * A bean's record as a draft, as a roaster's (use-roaster-draft.ts): an unsaved edit is kept in
 * the edits store until Save or Cancel, so leaving and coming back finds it (docs/spec/ui.md,
 * Read and edit). With no bean, it is a new one, which Save adds.
 */
export function useBeanDraft(bean: Bean | undefined) {
  const { api, stores } = useDeps();
  const run = useRun();
  const key = bean?.id ?? NEW_BEAN;
  const saved = useMemo(() => toBeanDraft(bean), [bean]);
  const kept = useEdits((s) => s.beans[key]);
  const draft = kept ?? saved;
  const [problem, setProblem] = useState<string>();
  const checked = useMemo(() => fromBeanDraft(draft), [draft]);
  const forget = () => {
    stores.edits.setState((s) => ({ beans: without(s.beans, key) }));
  };
  const change = (cells: Partial<BeanDraft>) => {
    const next = { ...draft, ...cells };
    // An edit undone by hand is no edit.
    if (JSON.stringify(next) === JSON.stringify(saved)) forget();
    else stores.edits.setState((s) => ({ beans: { ...s.beans, [key]: next } }));
  };
  const edited = kept !== undefined;
  // A required cell left empty on a new bean isn't a mistake yet: Save just waits.
  const allErrors = checked.ok ? {} : checked.error;
  const errors = Object.fromEntries(
    Object.entries(allErrors).filter(([cell]) => {
      const k = cell as keyof BeanDraft;
      return draft[k] !== saved[k];
    }),
  ) as typeof allErrors;
  const save = (onSaved: (id: BeanId) => void) => {
    if (!checked.ok) return;
    const fields = checked.value;
    run(
      'beans.save-failed',
      async () => {
        const done = (id: BeanId) => {
          forget();
          setProblem(undefined);
          onSaved(id);
        };
        if (bean) {
          const updated = await api.updateBean({ id: bean.id, fields, profileId: bean.profileId });
          if (updated.ok) done(bean.id);
          else setProblem("Couldn't save this bean · see Logs");
          return;
        }
        const added = await api.addBean(fields);
        if (added.ok) done(added.value);
        else setProblem("Couldn't save this bean · see Logs");
      },
      { failed: "Couldn't save the bean · try again" },
    );
  };
  const cancel = () => {
    forget();
    setProblem(undefined);
  };
  return {
    draft,
    change,
    errors,
    edited,
    canSave: edited && checked.ok,
    save,
    cancel,
    problem,
    setProblem,
  };
}

export type BeanDraftState = ReturnType<typeof useBeanDraft>;
