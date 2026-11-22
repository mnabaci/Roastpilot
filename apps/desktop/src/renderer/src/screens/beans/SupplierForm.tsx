import type { Supplier, SupplierError } from '@roastpilot/shared';
import { Button, ConfirmDialog, TextAreaField, TextField } from '@roastpilot/ui';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { WaitingButton } from '../../features/WaitingButton';
import {
  beanCount,
  fromSupplierDraft,
  toSupplierDraft,
  type SupplierDraft,
} from './supplier-draft';

/** A refused write in words: a name in use goes under Name, the rest under the buttons. */
function refusal(error: SupplierError): { name?: string; problem?: string } {
  if (error.kind === 'name-taken') return { name: `You have a supplier named ${error.name}` };
  if (error.kind === 'has-beans') return { problem: `Used by ${beanCount(error.beans)}` };
  return { problem: "Couldn't save this supplier · see Logs" };
}

/**
 * One supplier's details in the Suppliers dialog, or a new one's: name, website, email, phone and
 * notes; Delete only while no bean names it (docs/spec/beans-favourites-ghost.md, Suppliers).
 */
export function SupplierForm({
  supplier,
  beans,
  onDone,
}: {
  /** None: a new supplier. */
  supplier: Supplier | undefined;
  /** How many beans name it, archived ones too. */
  beans: number;
  onDone: () => void;
}) {
  const { api } = useDeps();
  const run = useRun();
  const saved = useMemo(() => toSupplierDraft(supplier), [supplier]);
  const [draft, setDraft] = useState<SupplierDraft>(saved);
  const [nameTaken, setNameTaken] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const checked = fromSupplierDraft(draft);
  // A cell you haven't changed isn't a mistake yet: a new supplier waits for its name.
  const errors = checked.ok ? {} : checked.error;
  const shown = (cell: keyof SupplierDraft) =>
    draft[cell] !== saved[cell] ? errors[cell] : undefined;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const cell = (key: keyof SupplierDraft, label: string, type?: 'email' | 'tel' | 'url') => {
    const error = key === 'name' ? (nameTaken ?? shown(key)) : shown(key);
    return (
      <div className="flex flex-col gap-1">
        <TextField
          label={label}
          value={draft[key]}
          {...(type ? { inputMode: type } : {})}
          aria-invalid={error ? true : undefined}
          onChange={(value) => {
            setDraft({ ...draft, [key]: value });
            if (key === 'name') setNameTaken(undefined);
          }}
        />
        {error ? <p className="text-label text-critical-text">{error}</p> : null}
      </div>
    );
  };
  const write = (call: () => Promise<{ ok: true } | { ok: false; error: SupplierError }>) => {
    setBusy(true);
    setProblem(undefined);
    run(
      'suppliers.save-failed',
      async () => {
        try {
          const written = await call();
          if (written.ok) {
            onDone();
            return;
          }
          const { name, problem: line } = refusal(written.error);
          setNameTaken(name);
          setProblem(line);
        } finally {
          setBusy(false);
        }
      },
      { failed: "Couldn't save the supplier · try again" },
    );
  };
  const save = () => {
    if (!checked.ok) return;
    const fields = checked.value;
    write(() =>
      supplier ? api.updateSupplier({ id: supplier.id, fields }) : api.addSupplier(fields),
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 items-start gap-x-3 gap-y-4">
        {cell('name', 'Name')}
        {cell('website', 'Website', 'url')}
        {cell('email', 'Email', 'email')}
        {cell('phone', 'Phone', 'tel')}
        <TextAreaField
          className="col-span-2"
          label="Notes"
          value={draft.notes}
          onChange={(notes) => {
            setDraft({ ...draft, notes });
          }}
        />
      </div>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {supplier ? (
          <WaitingButton
            size="sm"
            variant="ghost"
            className="text-critical-text"
            disabled={beans > 0 || busy}
            reason={
              beans > 0
                ? `Used by ${beanCount(beans)} · pick another supplier on them first`
                : undefined
            }
            onClick={() => {
              setDeleting(true);
            }}
          >
            Delete
          </WaitingButton>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={onDone}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={busy || !changed || !checked.ok}
            onClick={save}
          >
            {supplier ? 'Save' : 'Add supplier'}
          </Button>
        </div>
      </div>
      {supplier ? (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          question={`Delete ${supplier.name}?`}
          detail="Its website and contacts go too"
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            write(() => api.deleteSupplier(supplier.id));
          }}
        />
      ) : null}
    </div>
  );
}
