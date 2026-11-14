import type { Bean, BeanProcess, BeanSpecies } from '@roastpilot/shared';
import {
  Button,
  NumberField,
  ReadValue,
  SegmentedControl,
  SelectField,
  TextField,
} from '@roastpilot/ui';
import { ExternalLink } from 'lucide-react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { siteOf } from './bean-detail';
import type { BeanDraftState } from './use-bean-draft';

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
type TextKey = 'origin' | 'variety' | 'supplier' | 'link' | 'notes';

const NUMBER_CELLS: Readonly<Record<NumberKey, { label: string; unit?: string }>> = {
  altitudeM: { label: 'Altitude', unit: 'm' },
  screen: { label: 'Screen size' },
  densityGL: { label: 'Density', unit: 'g/L' },
  moisturePct: { label: 'Moisture', unit: '%' },
  lowStockG: { label: 'Low stock below', unit: 'g' },
};

/**
 * A bean's record as one grid, the same in read and in Edit (docs/spec/ui.md, Read and edit):
 * read, each value sits where its field goes, "–" when empty; Edit swaps them for the fields.
 * Its name is the page's title, not a cell here.
 */
export function BeanFields({
  bean,
  state,
  readOnly,
}: {
  bean: Bean | undefined;
  state: BeanDraftState;
  readOnly: boolean;
}) {
  const { api } = useDeps();
  const run = useRun();
  const { draft, change, errors, setProblem } = state;
  const textCell = (key: TextKey, label: string, className: string) => (
    <div className={`flex flex-col gap-1 ${className}`}>
      <TextField
        label={label}
        value={draft[key]}
        readOnly={readOnly}
        onChange={(value) => {
          change({ [key]: value });
        }}
      />
      {errors[key] && !readOnly ? (
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
        readOnly={readOnly}
        invalid={errors[key] !== undefined}
        hint={errors[key]}
        className="col-span-2"
        onChange={(value) => {
          change({ [key]: value });
        }}
      />
    );
  };
  const savedLink = bean?.link != null && draft.link.trim() === bean.link;
  return (
    // One 6-column grid for every row, so the columns line up from top to bottom.
    <div className="grid grid-cols-6 gap-x-3 gap-y-4">
      {textCell('origin', 'Origin', 'col-span-3')}
      {textCell('variety', 'Variety', 'col-span-3')}
      <SelectField
        label="Species"
        value={draft.species}
        options={SPECIES}
        readOnly={readOnly}
        onChange={(species) => {
          change({ species });
        }}
        className="col-span-3"
      />
      <SelectField
        label="Process"
        value={draft.process}
        options={PROCESSES}
        readOnly={readOnly}
        onChange={(process) => {
          change({ process });
        }}
        className="col-span-3"
      />
      {numberCell('altitudeM')}
      {numberCell('screen')}
      {readOnly ? (
        <ReadValue label="Decaf" value={draft.decaf ? 'Yes' : 'No'} className="col-span-2" />
      ) : (
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
      )}
      {numberCell('densityGL')}
      {numberCell('moisturePct')}
      {numberCell('lowStockG')}
      {readOnly ? null : (
        <p className="col-span-6 -mt-2 text-label text-ink-muted">
          Density is the one to measure: weigh a fixed volume of green beans.
        </p>
      )}
      {textCell('supplier', 'Supplier', 'col-span-3')}
      {readOnly ? (
        // Its site, short and as written; Order again in the header opens the page.
        <ReadValue
          label="Order link"
          value={draft.link.trim() ? siteOf(draft.link.trim()) : ''}
          className="col-span-3"
        />
      ) : (
        // Where to order it again: the button opens the saved link (main opens only a saved one).
        <div className="col-span-3 flex items-end gap-2">
          {textCell('link', 'Order link', 'min-w-0 flex-1')}
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
      )}
      {textCell('notes', 'Notes', 'col-span-6')}
    </div>
  );
}
