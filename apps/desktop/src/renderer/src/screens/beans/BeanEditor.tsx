import type { Bean, BeanId, BeanProcess } from '@roastpilot/shared';
import { Button, cn, NumberField, SegmentedControl, SelectField, TextField } from '@roastpilot/ui';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { fromBeanDraft, toBeanDraft, type BeanDraft } from './bean-draft';
import { PAGE_WIDTH } from '../../lib/page-width';

const PROCESSES: readonly { value: BeanProcess; label: string }[] = [
  { value: 'washed', label: 'Washed' },
  { value: 'natural', label: 'Natural' },
  { value: 'honey', label: 'Honey' },
  { value: 'other', label: 'Other' },
];

const NUMBERS: readonly { key: keyof BeanDraft; label: string; unit?: string }[] = [
  { key: 'densityGL', label: 'Density', unit: 'g/L' },
  { key: 'altitudeM', label: 'Altitude', unit: 'm' },
  { key: 'moisturePct', label: 'Moisture', unit: '%' },
  { key: 'screen', label: 'Bean size (screen)' },
  { key: 'lowStockG', label: 'Low stock below', unit: 'g' },
];

/** A new bean, or an existing one's details (docs/spec/beans-favourites-ghost.md, Beans). */
export function BeanEditor({
  bean,
  onDone,
  onAdded,
}: {
  bean: Bean | undefined;
  onDone: () => void;
  onAdded: (id: BeanId) => void;
}) {
  const { api } = useDeps();
  const run = useRun();
  const [draft, setDraft] = useState(() => toBeanDraft(bean));
  const [problem, setProblem] = useState<string>();
  const checked = useMemo(() => fromBeanDraft(draft), [draft]);
  // A required cell left empty on a new bean isn't a mistake yet: Save just waits.
  const initial = useMemo(() => toBeanDraft(bean), [bean]);
  const errors = checked.ok ? {} : checked.error;
  const change = (cells: Partial<BeanDraft>) => {
    setDraft((current) => ({ ...current, ...cells }));
  };
  const save = () => {
    if (!checked.ok) return;
    const fields = checked.value;
    run(
      'beans.save-failed',
      async () => {
        if (bean) {
          const updated = await api.updateBean({ id: bean.id, fields, profileId: bean.profileId });
          if (updated.ok) onDone();
          else setProblem("Couldn't save this bean · see Logs");
          return;
        }
        const added = await api.addBean(fields);
        if (added.ok) onAdded(added.value);
        else setProblem("Couldn't save this bean · see Logs");
      },
      { failed: "Couldn't save the bean · try again" },
    );
  };
  const textCell = (key: 'name' | 'origin' | 'variety' | 'supplier', label: string) => (
    <div className="flex flex-col gap-1">
      <TextField
        label={label}
        value={draft[key]}
        onChange={(value) => {
          change({ [key]: value });
        }}
      />
      {errors[key] && draft[key] !== initial[key] ? (
        <p className="text-label text-critical-text">{errors[key]}</p>
      ) : null}
    </div>
  );
  return (
    <section
      aria-label={bean ? 'Edit bean' : 'Add bean'}
      className={cn('flex flex-col gap-4', PAGE_WIDTH)}
    >
      <div className="flex min-h-control-sm min-w-0 items-center">
        <h2 className="truncate text-title">{bean ? `Edit ${bean.name}` : 'Add a bean'}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {textCell('name', 'Name')}
        {textCell('origin', 'Origin')}
        <SelectField
          label="Process"
          value={draft.process}
          options={PROCESSES}
          onChange={(process) => {
            change({ process });
          }}
        />
        {textCell('variety', 'Variety')}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-label text-ink-muted">Decaf</p>
        <SegmentedControl
          label="Decaf"
          className="self-start"
          options={[
            { value: false, label: 'No' },
            { value: true, label: 'Yes' },
          ]}
          value={draft.decaf}
          onChange={(decaf) => {
            change({ decaf });
          }}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {NUMBERS.map(({ key, label, unit }) => (
          <NumberField
            key={key}
            label={label}
            {...(unit ? { unit } : {})}
            value={String(draft[key])}
            invalid={errors[key] !== undefined}
            hint={errors[key]}
            onChange={(value) => {
              change({ [key]: value });
            }}
          />
        ))}
      </div>
      <p className="text-label text-ink-muted">
        Density is the one to measure: weigh a fixed volume of green beans.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {textCell('supplier', 'Supplier')}
        <TextField
          label="Notes"
          value={draft.notes}
          onChange={(notes) => {
            change({ notes });
          }}
        />
      </div>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="primary" disabled={!checked.ok} onClick={save}>
          {bean ? 'Save' : 'Add bean'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
