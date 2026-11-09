import type { ProfileEntry } from '@roastpilot/shared';
import { Badge, Button, ConfirmDialog, Menu, type MenuItem } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { EditActions } from '../../features/EditActions';
import { useLibraryFiles } from '../../features/use-library-files';
import { IN_USE } from '../../features/profile-messages';
import { useRun } from '../../features/use-run';
import { useToast } from '../../features/use-toast';
import { useRoasters } from '../../stores/use-stores';
import { useSaveSettings } from '../settings/use-save-settings';
import type { ProfileDraftState } from './use-profile-draft';

/** The one next thing to do with this profile, and the rest behind "⋯" (docs/spec/ui.md, Header). */
export function ProfileActions({
  entry,
  state,
  active,
  locked,
  editing,
  onEditingChange,
  onSelect,
  onCopied,
}: {
  entry: ProfileEntry;
  state: ProfileDraftState;
  active: boolean;
  /** Auto is running a profile: the choice, and the one it runs, wait until Drop. */
  locked: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSelect: (id: string) => void;
  onCopied: (message: string) => void;
}) {
  const { api, stores, logger } = useDeps();
  const run = useRun();
  const saveSettings = useSaveSettings();
  const [problem, setProblem] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const { id } = entry.profile;
  const others = useRoasters((s) => s.roasters).filter((r) => !r.active);
  const files = useLibraryFiles('profiles');
  const toast = useToast();
  const refresh = async () => {
    stores.auto.setState({ profiles: await api.listProfiles() });
  };
  const refused = (error: { kind: string; message?: string }) => {
    logger.warn('profiles.refused', { ...error });
    setProblem(error.message ?? "That didn't work · see the log");
  };
  const save = () => {
    const { valid } = state;
    if (!valid) return;
    run(
      'profiles.save-failed',
      async () => {
        const saved = await api.saveProfile(valid);
        if (!saved.ok) {
          refused(saved.error);
          return;
        }
        setProblem(undefined);
        await refresh();
        state.discard();
        onEditingChange(false);
      },
      { failed: "Couldn't save the profile · try again" },
    );
  };
  const duplicate = () => {
    run(
      'profiles.duplicate-failed',
      async () => {
        const copy = await api.duplicateProfile(id);
        if (!copy.ok) {
          refused(copy.error);
          return;
        }
        setProblem(undefined);
        await refresh();
        onSelect(copy.value.profile.id);
      },
      { failed: "Couldn't duplicate the profile · try again" },
    );
  };
  const copyTo = (roasterId: number, name: string) => {
    run(
      'profiles.copy-failed',
      async () => {
        const copy = await api.copyProfile({ id, roasterId });
        if (!copy.ok && copy.error.kind === 'already-copied') {
          setProblem(undefined);
          onCopied(`${name} already has it as "${copy.error.name}"`);
          return;
        }
        if (!copy.ok) {
          refused(copy.error);
          return;
        }
        setProblem(undefined);
        // The copy isn't in this list: profiles belong to a roaster.
        onCopied(
          `Copied to ${name} as "${copy.value.profile.name}" · make ${name} active to see it`,
        );
      },
      { failed: "Couldn't copy the profile · try again" },
    );
  };
  // Saves the profile as it is saved, so an unsaved edit stays an edit.
  const setNeedsCalibration = (needsCalibration: boolean) => {
    run(
      'profiles.calibration-failed',
      async () => {
        const saved = await api.saveProfile({ ...entry.profile, needsCalibration });
        if (!saved.ok) {
          refused(saved.error);
          return;
        }
        setProblem(undefined);
        await refresh();
      },
      { failed: "Couldn't change the profile · try again" },
    );
  };
  const remove = () => {
    run(
      'profiles.delete-failed',
      async () => {
        const deleted = await api.deleteProfile(id);
        if (!deleted.ok && deleted.error.kind === 'in-use') {
          logger.warn('profiles.refused', { ...deleted.error });
          toast('error', IN_USE);
          return;
        }
        if (!deleted.ok) {
          refused(deleted.error);
          return;
        }
        state.discard();
        await refresh();
      },
      { failed: "Couldn't delete the profile · try again" },
    );
  };
  const yours = !entry.builtIn && !(active && locked);
  const { needsCalibration } = entry.profile;
  const more: MenuItem[] = [
    // A built-in's Duplicate is its button.
    ...(entry.builtIn ? [] : [{ label: 'Duplicate', onSelect: duplicate }]),
    ...others.map((roaster) => ({
      label: `Copy to ${roaster.name}`,
      onSelect: () => {
        copyTo(roaster.id, roaster.name);
      },
    })),
    ...(yours
      ? [
          {
            label: needsCalibration ? 'Mark as calibrated' : 'Mark as needs calibration',
            onSelect: () => {
              setNeedsCalibration(!needsCalibration);
            },
          },
        ]
      : []),
    {
      label: 'Export this profile',
      onSelect: () => {
        files.exportFile({ kind: 'profiles', ids: [id] });
      },
    },
    // The one Auto uses (or runs) stays listed, disabled with why: pick another for Auto first.
    ...(entry.builtIn
      ? []
      : [
          {
            label: 'Delete',
            destructive: true,
            onSelect: () => {
              setDeleting(true);
            },
            ...(active && { disabled: true, hint: locked ? 'Running now' : 'Auto uses this one' }),
          },
        ]),
  ];
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {editing ? (
          // Cancel throws the edit away; Save waits for a change it can save.
          <EditActions
            onCancel={() => {
              setProblem(undefined);
              state.discard();
              onEditingChange(false);
            }}
            onSave={save}
            canSave={state.edited && state.valid !== undefined && !(active && locked)}
          />
        ) : (
          <>
            {active ? (
              <Badge tone="air">Auto</Badge>
            ) : (
              <Button
                variant="primary"
                size="sm"
                disabled={locked}
                onClick={() => {
                  saveSettings({ autoProfile: id });
                }}
              >
                Use for Auto
              </Button>
            )}
            {/* A built-in can't change: its copy can. */}
            {entry.builtIn ? (
              <Button size="sm" onClick={duplicate}>
                Duplicate
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  onEditingChange(true);
                }}
              >
                Edit
              </Button>
            )}
          </>
        )}
        <Menu label={`More for ${entry.profile.name}`} items={more} />
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        question="Delete this profile?"
        detail="saved roasts keep their copy"
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
