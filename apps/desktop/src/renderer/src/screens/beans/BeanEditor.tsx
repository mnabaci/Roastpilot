import type { Bean, BeanId, BeanProcess, BeanSpecies } from '@roastpilot/shared';
import { Button, cn, NumberField, SegmentedControl, SelectField, TextField } from '@roastpilot/ui';
import { ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { EditActions } from '../../features/EditActions';
import { useRun } from '../../features/use-run';
import { fromBeanDraft, toBeanDraft, type BeanDraft } from './bean-draft';
import { PAGE_WIDTH } from '../../lib/page-width';

const PROCESSES: readonly { value: BeanProcess; label: string }[] = [
  { value: 'washed', label: 'Washed' },
  { value: 'natural', label: 'Natural' },
  { value: 'honey', label: 'Honey' },
  { value: 'other', label: 'Other' },
];

const SPECIES: readonly { value: BeanSpecies | ''; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'arabica', label: 'Arabica' },
  { value: 'robusta', label: 'Robusta' },
  { value: 'liberica', label: 'Liberica' },
  { value: 'excelsa', label: 'Excelsa' },
  { value: 'other', label: 'Other' },
];

type NumberKey = 'densityGL' | 'altitudeM' | 'moisturePct' | 'screen' | 'lowStockG';

/** Units sit inside the field, never in the label; screen size is a number of its own. */
const NUMBER_CELLS: Readonly<Record<NumberKey, { label: string; unit?: string }>> = {
  altitudeM: { label: 'Altitude', unit: 'm' },
  screen: { label: 'Screen size' },
  densityGL: { label: 'Density', unit: 'g/L' },
  moisturePct: { label: 'Moisture', unit: '%' },
  lowStockG: { label: 'Low stock below', unit: 'g' },
};

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
  const textCell = (key: 'name' | 'origin' | 'variety' | 'supplier' | 'link', label: string) => (
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
  const numberCell = (key: NumberKey) => {
    const { label, unit } = NUMBER_CELLS[key];
    return (
      <NumberField
        label={label}
        {...(unit ? { unit } : {})}
        value={draft[key]}
        invalid={errors[key] !== undefined}
        hint={errors[key]}
        onChange={(value) => {
          change({ [key]: value });
        }}
      />
    );
  };
  const savedLink = bean?.link != null && draft.link.trim() === bean.link;
  return (
    <section
      aria-label={bean ? 'Edit bean' : 'Add bean'}
      className={cn('flex flex-col gap-4', PAGE_WIDTH)}
    >
      <header className="flex min-h-control-sm min-w-0 items-center gap-3">
        <h2 className="min-w-0 truncate text-title">{bean ? `Edit ${bean.name}` : 'Add a bean'}</h2>
        <EditActions
          onCancel={onDone}
          onSave={save}
          canSave={checked.ok}
          saveLabel={bean ? 'Save' : 'Add bean'}
        />
      </header>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      {/* One 6-column grid for every row, so the columns line up from top to bottom. */}
      <div className="grid grid-cols-6 gap-x-3 gap-y-4">
        <div className="col-span-3">{textCell('name', 'Name')}</div>
        <div className="col-span-3">{textCell('origin', 'Origin')}</div>
        <SelectField
          label="Species"
          value={draft.species}
          options={SPECIES}
          onChange={(species) => {
            change({ species });
          }}
          className="col-span-2"
        />
        <SelectField
          label="Process"
          value={draft.process}
          options={PROCESSES}
          onChange={(process) => {
            change({ process });
          }}
          className="col-span-2"
        />
        <div className="col-span-2">{textCell('variety', 'Variety')}</div>
        <div className="col-span-2">{numberCell('altitudeM')}</div>
        <div className="col-span-2">{numberCell('screen')}</div>
        <div className="col-span-2 flex flex-col gap-1.5">
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
        <div className="col-span-2">{numberCell('densityGL')}</div>
        <div className="col-span-2">{numberCell('moisturePct')}</div>
        <div className="col-span-2">{numberCell('lowStockG')}</div>
        <p className="col-span-6 -mt-2 text-label text-ink-muted">
          Density is the one to measure: weigh a fixed volume of green beans.
        </p>
        <div className="col-span-3">{textCell('supplier', 'Supplier')}</div>
        {/* Where to order it again: Order again on the bean opens it, and so does the button,
            for the saved link (main opens only a saved one). */}
        <div className="col-span-3 flex items-end gap-2">
          <div className="min-w-0 flex-1">{textCell('link', 'Order link')}</div>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Open the order link"
            disabled={!savedLink}
            icon={<ExternalLink aria-hidden="true" />}
            onClick={() => {
              if (!bean) return;
              run(
                'beans.open-link-failed',
                async () => {
                  const opened = await api.openBeanLink(bean.id);
                  if (!opened.ok) setProblem("Couldn't open the order link · see Logs");
                },
                { failed: "Couldn't open the order link · try again" },
              );
            }}
          />
        </div>
        <TextField
          label="Notes"
          value={draft.notes}
          onChange={(notes) => {
            change({ notes });
          }}
          className="col-span-6"
        />
      </div>
    </section>
  );
}
