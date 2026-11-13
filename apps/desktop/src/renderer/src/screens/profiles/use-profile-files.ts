import type { LibraryItemId } from '@roastpilot/shared';
import { useLibraryFiles } from '../../features/use-library-files';

/** Profiles in and out as Roastpilot files; an import opens the newest (the list is pushed). */
export function useProfileFiles(onOpen: (id: string) => void) {
  return useLibraryFiles('profiles', (id: LibraryItemId) => {
    onOpen(String(id));
  });
}
