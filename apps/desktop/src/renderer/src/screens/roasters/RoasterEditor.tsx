import { modelFacts, type Roaster } from '@roastpilot/shared';
import { CollapsibleCard, NumberField, Switch, TextField } from '@roastpilot/ui';
import { useState, type ReactNode } from 'react';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from '../settings/use-save-settings';
import {
  DRUM_FIELDS,
  everydayFields,
  TUNING_FIELDS,
  tuningHint,
  type FieldGroup,
} from './roaster-fields';
import { sectionSummary, type RoasterSection } from './roaster-summaries';
import type { RoasterDraftState } from './use-roaster-draft';

/**
 * One roaster's record (docs/spec/ui.md, Roasters screen) as cards that fold to a one-line
 * summary: read until Edit, then fields whose Cancel and Save sit in the page's header. Which
 * cards are open is a setting; Edit opens the ones you'd type in, and a card with a problem stays
 * open, so a held-back Save is never unexplained.
 */
export function RoasterEditor({
  roaster,
  state,
  editing,
}: {
  roaster: Roaster;
  state: RoasterDraftState;
  editing: boolean;
}) {
  const { draft, setDraft, errors, problem, unit } = state;
  const readOnly = !editing;
  const facts = modelFacts(roaster.model);
  const groups = [...everydayFields(unit), ...(facts.drumSpeed ? [DRUM_FIELDS] : [])];
  const savedOpen = useSettings((s) => s.settings.roasterSectionsOpen);
  const saveSettings = useSaveSettings();
  // While editing, the open cards are this edit's own, not the saved choice.
  const [editOpen, setEditOpen] = useState<readonly string[]>([]);
  const [wasEditing, setWasEditing] = useState(editing);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (editing) {
      setEditOpen([
        ...groups.flatMap((g) => (g.section ? [g.section] : [])),
        ...(facts.beanCooler ? ['cooling'] : []),
        ...(savedOpen.includes('tuning') ? ['tuning'] : []),
      ]);
    }
  }
  const openList = editing ? editOpen : savedOpen;
  const hasProblem = (gs: readonly FieldGroup[]) =>
    gs.some((g) => g.cells.some((c) => Boolean(errors[c.key])));
  const card = (
    section: RoasterSection,
    title: string,
    withProblem: boolean,
    children: ReactNode,
  ) => (
    <CollapsibleCard
      key={section}
      title={title}
      summary={sectionSummary(section, draft, unit)}
      open={withProblem || openList.includes(section)}
      onOpenChange={(open) => {
        const next = [...openList.filter((s) => s !== section), ...(open ? [section] : [])];
        if (editing) setEditOpen(next);
        else saveSettings({ roasterSectionsOpen: next });
      }}
    >
      {children}
    </CollapsibleCard>
  );
  const cells = ({ hint, cells }: FieldGroup) => (
    <>
      {hint ? <p className="text-label text-ink-muted">{hint}</p> : null}
      <div className="grid grid-cols-3 items-start gap-3">
        {cells.map(({ key, label, unit }) => (
          <NumberField
            key={key}
            label={label}
            value={draft[key]}
            readOnly={readOnly}
            invalid={Boolean(errors[key])}
            hint={errors[key]}
            {...(unit ? { unit } : {})}
            onChange={(value) => {
              setDraft({ ...draft, [key]: value });
            }}
          />
        ))}
      </div>
    </>
  );
  return (
    <>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      {editing ? (
        <div className="flex flex-col gap-1.5 rounded-xl bg-surface px-5 py-4.5">
          <TextField
            label="Name"
            value={draft.name}
            onChange={(name) => {
              setDraft({ ...draft, name });
            }}
          />
          {errors.name ? <p className="text-label text-critical-text">{errors.name}</p> : null}
        </div>
      ) : null}
      {groups.map((group) =>
        group.section ? card(group.section, group.title, hasProblem([group]), cells(group)) : null,
      )}
      {facts.beanCooler
        ? card(
            'cooling',
            'Cooling',
            false,
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-body">Bean cooler helps cool the drum</p>
                <p className="text-label text-ink-muted">
                  Tray fan under the drum · stays on while the drum cools
                </p>
              </div>
              {readOnly ? (
                <p className="text-body text-ink">{draft.coolerHelpsDrum ? 'On' : 'Off'}</p>
              ) : (
                <Switch
                  aria-label="Bean cooler helps cool the drum"
                  checked={draft.coolerHelpsDrum}
                  onChange={(on) => {
                    setDraft({ ...draft, coolerHelpsDrum: on });
                  }}
                />
              )}
            </div>,
          )
        : null}
      {card(
        'tuning',
        'Advanced tuning',
        hasProblem(TUNING_FIELDS),
        <>
          <p className="text-label text-ink-muted">{tuningHint(unit)}</p>
          {TUNING_FIELDS.map((group) => (
            <fieldset key={group.title} className="flex flex-col gap-2 pt-2">
              <legend className="pb-1 text-body font-semibold">{group.title}</legend>
              {cells(group)}
            </fieldset>
          ))}
        </>,
      )}
    </>
  );
}
