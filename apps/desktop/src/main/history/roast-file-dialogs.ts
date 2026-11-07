/** A Roastpilot roast file's extension (docs/adr/0013-roastpilot-roast-files.md): JSON inside. */
export const ROAST_FILE_EXTENSION = 'rpr';

interface Filter {
  name: string;
  extensions: string[];
}

/** What the save dialog says and suggests for an export of `count` roasts, on `day`. */
export function exportDialog(
  format: 'csv' | 'roastpilot',
  count: number | 'all',
  day: Date,
): { title: string; defaultPath: string; filters: Filter[] } {
  const what = count === 1 ? 'roast' : 'roasts';
  const extension = format === 'csv' ? 'csv' : ROAST_FILE_EXTENSION;
  return {
    title: count === 'all' ? 'Export all roasts' : `Export ${String(count)} ${what}`,
    defaultPath: `Roastpilot ${what} ${day.toISOString().slice(0, 10)}.${extension}`,
    filters: [{ name: format === 'csv' ? 'CSV' : 'Roastpilot roasts', extensions: [extension] }],
  };
}

/** What the open dialog says and accepts. */
export function importDialog(kind: 'artisan' | 'roastpilot'): { title: string; filters: Filter[] } {
  return kind === 'artisan'
    ? {
        title: 'Import an Artisan roast',
        filters: [{ name: 'Artisan roast', extensions: ['alog'] }],
      }
    : {
        title: 'Import Roastpilot roasts',
        filters: [{ name: 'Roastpilot roasts', extensions: [ROAST_FILE_EXTENSION] }],
      };
}
