import type { ProfileEntry } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { ConfirmInline } from '../../features/ConfirmInline';
import { useRun } from '../../features/use-run';
import { useRoasters } from '../../stores/use-stores';
import { useSaveSettings } from '../settings/use-save-settings';
import type { ProfileDraftState } from './use-profile-draft';

/** The one next thing to do with this profile, and the quieter ones. */
export function ProfileActions({
  entry,
  state,
  active,
  locked,
  onSelect,
}: {
  entry: ProfileEntry;
  state: ProfileDraftState;
  active: boolean;
  /** Auto is running a profile: the choice, and the one it runs, wait until Drop. */
  locked: boolean;
  onSelect: (id: string) => void;
}) {
  const { api, stores, logger } = useDeps();
  const run = useRun();
  const saveSettings = useSaveSettings();
  const [problem, setProblem] = useState<string>();
  const { id } = entry.profile;
  const others = useRoasters((s) => s.roasters).filter((r) => !r.active);
  const [copied, setCopied] = useState<string>();
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
      setCopied(`Copied to ${name} · needs calibration there`);
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
  return (
    <div className="flex flex-wrap items-center gap-2">
      {state.edited ? (
        <>
          <Button variant="primary" disabled={!state.valid || (active && locked)} onClick={save}>
            Save
          </Button>
          <Button variant="ghost" onClick={state.discard}>
            Discard
          </Button>
        </>
      ) : (
        <>
          {active ? null : (
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
          <Button variant="secondary" onClick={duplicate}>
            Duplicate
          </Button>
          {others.map((roaster) => (
            <Button
              key={roaster.id}
              variant="ghost"
              onClick={() => {
                copyTo(roaster.id, roaster.name);
              }}
            >
              Copy to {roaster.name}
            </Button>
          ))}
          {entry.builtIn || (active && locked) ? null : (
            <ConfirmInline
              label="Delete"
              question="Delete this profile? · saved roasts keep their copy"
              confirmLabel="Delete"
              onConfirm={remove}
            />
          )}
        </>
      )}
      {copied ? <p className="w-full text-label text-ink-muted">{copied}</p> : null}
      {problem ? (
        <p role="alert" className="w-full text-label text-critical-text">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
