import type { ProfileEntry } from '@roastpilot/shared';
import { Badge, Button, ConfirmDialog, Menu, type MenuItem } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useRoasters } from '../../stores/use-stores';
import { useSaveSettings } from '../settings/use-save-settings';
import type { ProfileDraftState } from './use-profile-draft';

/** The one next thing to do with this profile, and the rest behind "⋯" (docs/spec/ui.md, Header). */
export function ProfileActions({
  entry,
  state,
  active,
  locked,
  onSelect,
  onCopied,
}: {
  entry: ProfileEntry;
  state: ProfileDraftState;
  active: boolean;
  /** Auto is running a profile: the choice, and the one it runs, wait until Drop. */
  locked: boolean;
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
    run('profiles.save-failed', async () => {
      const saved = await api.saveProfile(valid);
      if (!saved.ok) {
        refused(saved.error);
        return;
      }
      setProblem(undefined);
      await refresh();
      state.discard();
    });
  };
  const duplicate = () => {
    run('profiles.duplicate-failed', async () => {
      const copy = await api.duplicateProfile(id);
      if (!copy.ok) {
        refused(copy.error);
        return;
      }
      setProblem(undefined);
      await refresh();
      onSelect(copy.value.profile.id);
    });
  };
  const copyTo = (roasterId: number, name: string) => {
    run('profiles.copy-failed', async () => {
      const copy = await api.copyProfile({ id, roasterId });
      if (!copy.ok) {
        refused(copy.error);
        return;
      }
      setProblem(undefined);
      onCopied(`Copied to ${name} · needs calibration there`);
    });
  };
  const remove = () => {
    run('profiles.delete-failed', async () => {
      const deleted = await api.deleteProfile(id);
      if (!deleted.ok) {
        refused(deleted.error);
        return;
      }
      state.discard();
      await refresh();
    });
  };
  const deletable = !entry.builtIn && !(active && locked);
  const more: MenuItem[] = [
    { label: 'Duplicate', onSelect: duplicate },
    ...others.map((roaster) => ({
      label: `Copy to ${roaster.name}`,
      onSelect: () => {
        copyTo(roaster.id, roaster.name);
      },
    })),
    ...(deletable
      ? [
          {
            label: 'Delete',
            destructive: true,
            onSelect: () => {
              setDeleting(true);
            },
          },
        ]
      : []),
  ];
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {state.edited ? (
          <>
            <Button variant="primary" disabled={!state.valid || (active && locked)} onClick={save}>
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                // A refusal was about the edit going away with it.
                setProblem(undefined);
                state.discard();
              }}
            >
              Discard
            </Button>
          </>
        ) : active ? (
          <Badge tone="air">Auto</Badge>
        ) : (
          <Button
            variant="primary"
            disabled={locked}
            onClick={() => {
              saveSettings({ autoProfile: id });
            }}
          >
            Use for Auto
          </Button>
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
