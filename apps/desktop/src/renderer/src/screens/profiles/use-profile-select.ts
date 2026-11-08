import type { ProfileEntry, ProfileId } from '@roastpilot/shared';
import { useDeps } from '../../app/app-context';
import { IN_USE } from '../../features/profile-messages';
import { useLibraryFiles } from '../../features/use-library-files';
import { useRun } from '../../features/use-run';
import { useSelection } from '../../features/use-selection';
import { useToast } from '../../features/use-toast';
import { useProfileLocked } from '../roast/use-active-profile';

/**
 * Why a profile can't be ticked in Select (docs/spec/ui.md, Profiles, Select): a built-in, the one
 * Auto uses, or the one Auto is running until Drop. Undefined when it can.
 */
export function lockedReason(
  entry: ProfileEntry,
  autoId: ProfileId | undefined,
  running: boolean,
): string | undefined {
  if (entry.builtIn) return 'Built-in';
  if (entry.profile.id !== autoId) return undefined;
  return running ? 'Running now' : 'Auto uses this one';
}

/**
 * Select mode on the Profiles list: ticks on your own (not the one Auto uses), then Export or
 * Delete them all at once. After a delete, select mode ends and `onDeleted` opens Auto's profile.
 */
export function useProfileSelect(
  profiles: readonly ProfileEntry[],
  autoId: ProfileId | undefined,
  onDeleted: () => void,
) {
  const { api, stores } = useDeps();
  const run = useRun();
  const toast = useToast();
  const files = useLibraryFiles('profiles');
  const running = useProfileLocked();
  const reasonOf = (entry: ProfileEntry) => lockedReason(entry, autoId, running);
  const tickable = profiles.filter((entry) => reasonOf(entry) === undefined);
  const selection = useSelection(
    tickable.map((entry) => entry.profile.id),
    profiles.map((entry) => entry.profile.id),
  );
  const ids = [...selection.checked];
  const remove = () => {
    run(
      'profiles.delete-many-failed',
      async () => {
        const deleted = await api.deleteProfiles(ids);
        if (!deleted.ok) {
          toast(
            'error',
            deleted.error.kind === 'in-use' ? IN_USE : "Couldn't delete them · see Logs",
          );
          return;
        }
        const listed = await api.listProfiles();
        // Unsaved edits of a deleted profile go with it.
        stores.auto.setState((s) => ({
          profiles: listed,
          drafts: Object.fromEntries(Object.entries(s.drafts).filter(([id]) => !ids.includes(id))),
        }));
        selection.done();
        toast(
          'success',
          `Deleted ${String(ids.length)} ${ids.length === 1 ? 'profile' : 'profiles'}`,
        );
        onDeleted();
      },
      { failed: "Couldn't delete the profiles · try again" },
    );
  };
  return {
    ...selection,
    reasonOf,
    exportTicked: () => {
      files.exportFile({ kind: 'profiles', ids });
    },
    remove,
  };
}
