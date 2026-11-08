import type { ExportLibraryRequest, LibraryItemId, LibraryKind } from '@roastpilot/shared';
import { useDeps } from '../app/app-context';
import { exportProblemText, importedText, importProblemText } from './file-messages';
import { useTemperatureUnit } from './use-temperature-unit';
import { useRun } from './use-run';
import { useToast } from './use-toast';

/**
 * Beans, profiles or roasters in and out as Roastpilot files (docs/spec/data-model.md, Beans,
 * profiles and roasters files). How it went is a toast; an import opens the newest one it added.
 */
export function useLibraryFiles(
  kind: LibraryKind,
  onImported: (id: LibraryItemId) => void = () => undefined,
): {
  exportFile: (request: ExportLibraryRequest) => void;
  importFile: () => void;
} {
  const { api } = useDeps();
  const run = useRun();
  const toast = useToast();
  const unit = useTemperatureUnit();
  const exportFile = (request: ExportLibraryRequest) => {
    run(
      'files.export-failed',
      async () => {
        const saved = await api.exportLibrary(request);
        if (!saved.ok) toast('error', exportProblemText(saved.error));
        else if (saved.value.status === 'saved') toast('success', `Saved ${saved.value.fileName}`);
      },
      { failed: "Couldn't export · try again" },
    );
  };
  const importFile = () => {
    run(
      'files.import-failed',
      async () => {
        const imported = await api.importLibrary(kind);
        if (!imported.ok) toast('error', importProblemText(imported.error, unit));
        else if (imported.value.status === 'imported') {
          const { added, skipped, archived, newestId } = imported.value;
          toast('success', importedText(kind, added, skipped, archived));
          if (newestId !== null) onImported(newestId);
        }
      },
      { failed: "Couldn't import · try again" },
    );
  };
  return { exportFile, importFile };
}
