import type { ProfileEntry } from '@roastpilot/shared';
import { AlertBanner, Badge } from '@roastpilot/ui';
import { useState } from 'react';
import { RecordHeader } from '../../features/RecordHeader';
import { useProfileActions } from './ProfileActions';
import type { ProfileDraftState } from './use-profile-draft';

/**
 * The profile's header, as every record page's (RecordHeader): its name as the title, its badges
 * under it, its actions on the right; then what holds it back: a banner while Auto runs.
 */
export function ProfileHeader({
  entry,
  state,
  active,
  locked,
  editing,
  onEditingChange,
  onSelect,
}: {
  entry: ProfileEntry;
  state: ProfileDraftState;
  active: boolean;
  locked: boolean;
  /** Edit mode: the name is a field, and Cancel and Save replace the actions. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const { draft, errors, change, edited } = state;
  const [copied, setCopied] = useState<string>();
  const actions = useProfileActions({
    entry,
    state,
    active,
    locked,
    onEditingChange,
    onSelect,
    onCopied: setCopied,
  });
  const { builtIn } = entry;
  const { needsCalibration } = entry.profile;
  return (
    <>
      <RecordHeader
        name={draft.name}
        editing={editing}
        badges={
          active || builtIn || needsCalibration ? (
            <>
              {active ? <Badge tone="air">Auto</Badge> : null}
              {builtIn ? <Badge tone="neutral">Built-in</Badge> : null}
              {needsCalibration ? <Badge tone="neutral">Needs calibration</Badge> : null}
            </>
          ) : undefined
        }
        edit={{
          name: draft.name,
          onName: (name) => {
            change({ ...draft, name });
          },
          nameError: errors.name,
          edited,
          onCancel: actions.cancel,
          onSave: actions.save,
          canSave: actions.canSave,
        }}
        actions={actions.actions}
      />
      {actions.page}
      {/* Why Save (or Use for Auto) waits, plainly, right under the title: it goes at Drop. */}
      {locked ? (
        <AlertBanner kind="info">
          {active
            ? 'Auto is running this profile · edits save after Drop'
            : 'Auto is running another profile · Use for Auto after Drop'}
        </AlertBanner>
      ) : null}
      {copied ? <p className="text-label text-ink-muted">{copied}</p> : null}
    </>
  );
}
