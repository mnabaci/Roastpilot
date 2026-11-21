import { Badge, TitleField } from '@roastpilot/ui';
import type { ReactNode } from 'react';
import { EditActions } from './EditActions';

/**
 * The header of a bean's, profile's or roaster's page, the same on all three (docs/spec/ui.md,
 * Read and edit): the name as the title, a field in Edit; under it the record's badges, "Not
 * saved" while an edit is kept, and one quiet line; on the right its actions, or Cancel and Save
 * in Edit. A problem with the name is one line under the header.
 */
export function RecordHeader({
  name,
  editing,
  edit,
  badges,
  note,
  actions,
}: {
  name: string;
  editing: boolean;
  /** The draft's name and what Edit needs; the title reads `name` until then. */
  edit: {
    name: string;
    onName: (name: string) => void;
    nameError?: string | undefined;
    /** An unsaved edit is kept: "Not saved". */
    edited: boolean;
    onCancel: () => void;
    onSave: () => void;
    canSave: boolean;
    /** "Add bean" for a new one. */
    saveLabel?: string;
    placeholder?: string;
    /** A quiet helper before Cancel while editing. */
    lead?: ReactNode;
  };
  /** The record's own badges (Low stock, Built-in, Needs calibration). */
  badges?: ReactNode;
  /** One quiet line under the title (a roaster's model). */
  note?: string | null | undefined;
  /** What you can do while reading, primary first, Edit then "⋯" last. */
  actions: ReactNode;
}) {
  const notSaved = editing && edit.edited;
  const under = badges !== undefined || notSaved || note;
  return (
    <>
      <header className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* As tall as the sidebar's title row, so both titles share a line. */}
          <div className="flex min-h-control-sm min-w-0 items-center">
            {editing ? (
              <TitleField
                value={edit.name}
                invalid={Boolean(edit.nameError)}
                {...(edit.placeholder ? { placeholder: edit.placeholder } : {})}
                onChange={edit.onName}
              />
            ) : (
              <h2 className="truncate text-title text-ink">{name}</h2>
            )}
          </div>
          {under ? (
            <div className="flex min-h-6 flex-wrap items-center gap-2">
              {badges}
              {notSaved ? <Badge tone="heat">Not saved</Badge> : null}
              {note ? <p className="text-label text-ink-muted">{note}</p> : null}
            </div>
          ) : null}
        </div>
        {editing ? (
          <EditActions
            onCancel={edit.onCancel}
            onSave={edit.onSave}
            canSave={edit.canSave}
            {...(edit.saveLabel ? { saveLabel: edit.saveLabel } : {})}
            lead={edit.lead}
          />
        ) : (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </header>
      {editing && edit.nameError ? (
        <p role="alert" className="text-label text-critical-text">
          Name: {edit.nameError}
        </p>
      ) : null}
    </>
  );
}
