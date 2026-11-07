import type { ExportRoastsRequest, RoastId } from '@roastpilot/shared';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useToast } from '../../features/use-toast';

const IMPORT_PROBLEM: Readonly<Record<string, string>> = {
  'not-artisan': "That file isn't an Artisan roast",
  'not-roastpilot': "That file isn't a Roastpilot roast file",
  'newer-version': 'That file is from a newer Roastpilot · update to import it',
  'read-failed': "Couldn't read that file · see Logs",
};

/** "Imported 12 roasts · 3 were already here". */
export function importedText(added: number, skipped: number): string {
  const roasts = `${String(added)} ${added === 1 ? 'roast' : 'roasts'}`;
  if (skipped === 0) return `Imported ${roasts}`;
  const here = `${String(skipped)} ${skipped === 1 ? 'was' : 'were'} already here`;
  return `Imported ${roasts} · ${here}`;
}

/**
 * Roasts in and out as files: a Roastpilot file or CSV out (all, chosen or one), a Roastpilot
 * file or an Artisan `.alog` in. How it went is a toast; an import opens the newest roast it added.
 */
export function useRoastFiles(onImported: (id: RoastId) => void): {
  exportRoasts: (request: ExportRoastsRequest) => void;
  importRoasts: () => void;
  importAlog: () => void;
} {
  const { api } = useDeps();
  const run = useRun();
  const toast = useToast();
  const problem = (kind: string) => {
    toast('error', IMPORT_PROBLEM[kind] ?? "Couldn't import · see Logs");
  };
  const exportRoasts = (request: ExportRoastsRequest) => {
    run(
      'history.export-failed',
      async () => {
        const saved = await api.exportRoasts(request);
        if (!saved.ok) toast('error', "Couldn't export · see Logs");
        else if (saved.value.status === 'saved') toast('success', `Saved ${saved.value.fileName}`);
      },
      { failed: "Couldn't export · try again" },
    );
  };
  const importRoasts = () => {
    run(
      'history.import-failed',
      async () => {
        const imported = await api.importRoasts();
        if (!imported.ok) problem(imported.error.kind);
        else if (imported.value.status === 'imported') {
          const { added, skipped, newestId } = imported.value;
          toast('success', importedText(added, skipped));
          if (newestId !== null) onImported(newestId);
        }
      },
      { failed: "Couldn't import · try again" },
    );
  };
  const importAlog = () => {
    run(
      'history.import-failed',
      async () => {
        const imported = await api.importArtisan();
        if (!imported.ok) problem(imported.error.kind);
        else if (imported.value.status === 'imported') {
          toast('success', 'Roast imported');
          onImported(imported.value.id);
        }
      },
      { failed: "Couldn't import · try again" },
    );
  };
  return { exportRoasts, importRoasts, importAlog };
}
