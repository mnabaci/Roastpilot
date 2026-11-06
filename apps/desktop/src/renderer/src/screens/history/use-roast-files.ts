import type { ExportRoastsRequest, RoastId } from '@roastpilot/shared';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';

const IMPORT_PROBLEM: Readonly<Record<string, string>> = {
  'not-artisan': "That file isn't an Artisan roast",
  'not-roastpilot': "That file isn't a Roastpilot roast file",
  'newer-version': 'That file is from a newer Roastpilot · update to import it',
  'read-failed': "Couldn't read that file · see Logs",
};

export interface FileMessage {
  text: string;
  problem: boolean;
}

/** "Imported 12 roasts · 3 were already here". */
export function importedText(added: number, skipped: number): string {
  const roasts = `${String(added)} ${added === 1 ? 'roast' : 'roasts'}`;
  if (skipped === 0) return `Imported ${roasts}`;
  const here = `${String(skipped)} ${skipped === 1 ? 'was' : 'were'} already here`;
  return `Imported ${roasts} · ${here}`;
}

/**
 * Roasts in and out as files: a Roastpilot file or CSV out (all, chosen or one), a Roastpilot
 * file or an Artisan `.alog` in; one line on how it went.
 */
export function useRoastFiles(onImported: (id: RoastId) => void): {
  exportRoasts: (request: ExportRoastsRequest) => void;
  importRoasts: () => void;
  importAlog: () => void;
  message: FileMessage | undefined;
} {
  const { api } = useDeps();
  const run = useRun();
  const [message, setMessage] = useState<FileMessage>();
  const problem = (kind: string) => {
    setMessage({ text: IMPORT_PROBLEM[kind] ?? "Couldn't import · see Logs", problem: true });
  };
  const exportRoasts = (request: ExportRoastsRequest) => {
    setMessage(undefined);
    run('history.export-failed', async () => {
      const saved = await api.exportRoasts(request);
      if (!saved.ok) setMessage({ text: "Couldn't export · see Logs", problem: true });
      else if (saved.value.status === 'saved')
        setMessage({ text: `Saved ${saved.value.fileName}`, problem: false });
    });
  };
  const importRoasts = () => {
    setMessage(undefined);
    run('history.import-failed', async () => {
      const imported = await api.importRoasts();
      if (!imported.ok) problem(imported.error.kind);
      else if (imported.value.status === 'imported')
        setMessage({
          text: importedText(imported.value.added, imported.value.skipped),
          problem: false,
        });
    });
  };
  const importAlog = () => {
    setMessage(undefined);
    run('history.import-failed', async () => {
      const imported = await api.importArtisan();
      if (!imported.ok) problem(imported.error.kind);
      else if (imported.value.status === 'imported') {
        setMessage({ text: 'Roast imported', problem: false });
        onImported(imported.value.id);
      }
    });
  };
  return { exportRoasts, importRoasts, importAlog, message };
}
