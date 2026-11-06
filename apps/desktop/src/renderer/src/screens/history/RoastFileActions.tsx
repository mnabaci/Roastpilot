import type { RoastId } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';

const IMPORT_PROBLEM: Readonly<Record<string, string>> = {
  'not-artisan': "That file isn't an Artisan roast",
  'read-failed': "Couldn't read that file · see Logs",
};

/** Roasts in and out as files: CSV for spreadsheets, `.alog` from Artisan. */
export function RoastFileActions({
  canExport,
  onImported,
}: {
  canExport: boolean;
  onImported: (id: RoastId) => void;
}) {
  const { api } = useDeps();
  const run = useRun();
  const [message, setMessage] = useState<{ text: string; problem: boolean }>();

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

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {canExport ? (
          <Button size="sm" variant="ghost" onClick={exportCsv}>
            Export CSV
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={importAlog}>
          Import from Artisan
        </Button>
      </div>
      {message ? (
        <p
          {...(message.problem ? { role: 'alert' } : {})}
          className={`text-label ${message.problem ? 'text-critical-text' : 'text-ink-muted'}`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
