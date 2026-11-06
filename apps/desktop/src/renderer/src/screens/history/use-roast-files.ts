import type { RoastId } from '@roastpilot/shared';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';

const IMPORT_PROBLEM: Readonly<Record<string, string>> = {
  'not-artisan': "That file isn't an Artisan roast",
  'read-failed': "Couldn't read that file · see Logs",
};

export interface FileMessage {
  text: string;
  problem: boolean;
}

/** Roasts in and out as files: CSV for spreadsheets, `.alog` from Artisan; one line on how it went. */
export function useRoastFiles(onImported: (id: RoastId) => void): {
  exportCsv: () => void;
  importAlog: () => void;
  message: FileMessage | undefined;
} {
  const { api } = useDeps();
  const run = useRun();
  const [message, setMessage] = useState<FileMessage>();
  const exportCsv = () => {
    setMessage(undefined);
    run('history.export-failed', async () => {
      const saved = await api.exportRoastsCsv();
      if (!saved.ok) setMessage({ text: "Couldn't export · see Logs", problem: true });
      else if (saved.value.status === 'saved')
        setMessage({ text: `Saved ${saved.value.fileName}`, problem: false });
    });
  };
  const importAlog = () => {
    setMessage(undefined);
    run('history.import-failed', async () => {
      const imported = await api.importArtisan();
      if (!imported.ok) {
        const text = IMPORT_PROBLEM[imported.error.kind] ?? "Couldn't import · see Logs";
        setMessage({ text, problem: true });
      } else if (imported.value.status === 'imported') {
        setMessage({ text: 'Roast imported', problem: false });
        onImported(imported.value.id);
      }
    });
  };
  return { exportCsv, importAlog, message };
}
