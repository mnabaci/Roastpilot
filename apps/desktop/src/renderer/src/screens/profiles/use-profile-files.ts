import type { LibraryItemId } from '@roastpilot/shared';
import { useDeps } from '../../app/app-context';
import { useLibraryFiles } from '../../features/use-library-files';
import { useRun } from '../../features/use-run';

/** Profiles in and out as Roastpilot files; an import reloads the list and opens the newest. */
export function useProfileFiles(onOpen: (id: string) => void) {
  const { api, stores } = useDeps();
  const run = useRun();
  return useLibraryFiles('profiles', (id: LibraryItemId) => {
    run(
      'profiles.refresh-failed',
      async () => {
        stores.auto.setState({ profiles: await api.listProfiles() });
        onOpen(String(id));
      },
      { failed: "Couldn't show the imported profile · try again" },
    );
  });
}
