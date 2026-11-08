import type { ProfileEntry } from '@roastpilot/shared';
import { AlertBanner, Badge } from '@roastpilot/ui';
import { useState } from 'react';
import { ProfileActions } from './ProfileActions';
import type { ProfileDraftState } from './use-profile-draft';

/** The name as the title with its badges and actions, then what holds it back: a banner while Auto runs. */
export function ProfileHeader({
  entry,
  state,
  active,
  locked,
  onSelect,
}: {
  entry: ProfileEntry;
  state: ProfileDraftState;
  active: boolean;
  locked: boolean;
  onSelect: (id: string) => void;
}) {
  const { draft, errors, change, edited } = state;
  const readOnly = entry.builtIn;
  const [copied, setCopied] = useState<string>();
  return (
    <>
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          {/* The name is the title; click it to rename (built-ins are read-only). */}
          <input
            aria-label="Name"
            value={draft.name}
            disabled={readOnly}
            aria-invalid={Boolean(errors.name) || undefined}
            onChange={(event) => {
              change({ ...draft, name: event.target.value });
            }}
            className="-mx-2 h-control-sm w-full truncate rounded-md bg-transparent px-2 text-title text-ink hover:bg-surface-hover focus-visible:bg-surface focus-visible:outline-2 focus-visible:outline-focus disabled:hover:bg-transparent"
          />
          <div className="flex flex-wrap items-center gap-2">
            {entry.builtIn ? <Badge tone="neutral">Built-in</Badge> : null}
            {entry.profile.needsCalibration ? (
              <Badge tone="neutral">Needs calibration</Badge>
            ) : null}
            {edited ? <Badge tone="heat">Not saved</Badge> : null}
          </div>
        </div>
        <ProfileActions
          entry={entry}
          state={state}
          active={active}
          locked={locked}
          onSelect={onSelect}
          onCopied={setCopied}
        />
      </header>
      {/* Why Save (or Use for Auto) waits, plainly, right under the title: it goes at Drop. */}
      {locked ? (
        <AlertBanner kind="info">
          {active
            ? 'Auto is running this profile · edits save after Drop'
            : 'Auto is running another profile · Use for Auto after Drop'}
        </AlertBanner>
      ) : null}
      {readOnly || copied ? (
        <p className="text-label text-ink-muted">
          {[readOnly ? 'Duplicate it to change it' : undefined, copied].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {errors.name ? (
        <p role="alert" className="text-label text-critical-text">
          Name: {errors.name}
        </p>
      ) : null}
    </>
  );
}
