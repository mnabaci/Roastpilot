import type { Logger } from '@roastpilot/core';
import type { BrowserWindow } from 'electron';

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

/** The window a dialog opens on: on macOS it is a sheet on that window. */
export type DialogParent = BrowserWindow;

/** Electron's `dialog`, narrowed to the two calls History uses, always with a parent window. */
export interface FileDialogs {
  showSaveDialog(
    parent: DialogParent,
    options: ReturnType<typeof exportDialog>,
  ): Promise<{ canceled: boolean; filePath: string }>;
  showOpenDialog(
    parent: DialogParent,
    options: ReturnType<typeof importDialog> & { properties: ['openFile'] },
  ): Promise<{ canceled: boolean; filePaths: string[] }>;
}

export type ChooseExportPath = (
  format: 'csv' | 'roastpilot',
  count: number | 'all',
  parent: DialogParent,
) => Promise<string | undefined>;
export type ChooseImportPath = (
  kind: 'artisan' | 'roastpilot',
  parent: DialogParent,
) => Promise<string | undefined>;

/** Asks where to save an export; undefined when you cancel (or the dialog gives no path). */
export function exportPathChooser(
  dialogs: Pick<FileDialogs, 'showSaveDialog'>,
  now: () => Date,
): ChooseExportPath {
  return async (format, count, parent) => {
    const { canceled, filePath } = await dialogs.showSaveDialog(
      parent,
      exportDialog(format, count, now()),
    );
    return canceled || filePath === '' ? undefined : filePath;
  };
}

/** Asks which file to import; undefined when you cancel. */
export function importPathChooser(dialogs: Pick<FileDialogs, 'showOpenDialog'>): ChooseImportPath {
  return async (kind, parent) => {
    const { canceled, filePaths } = await dialogs.showOpenDialog(parent, {
      ...importDialog(kind),
      properties: ['openFile'],
    });
    return canceled ? undefined : filePaths[0];
  };
}

/**
 * The export and import choosers, sharing one rule: a single file dialog at a time. A second
 * click while one is open counts as cancelled (logged), so it never stacks another dialog.
 */
export function pathChoosers({
  dialogs,
  now,
  logger,
}: {
  dialogs: FileDialogs;
  now: () => Date;
  logger: Logger;
}): { chooseExportPath: ChooseExportPath; chooseImportPath: ChooseImportPath } {
  let open = false;
  const oneAtATime =
    <A extends unknown[]>(
      dialog: string,
      choose: (...args: A) => Promise<string | undefined>,
    ): ((...args: A) => Promise<string | undefined>) =>
    async (...args) => {
      if (open) {
        logger.info('history.dialog-already-open', { dialog });
        return undefined;
      }
      open = true;
      try {
        return await choose(...args);
      } finally {
        open = false;
      }
    };
  return {
    chooseExportPath: oneAtATime('export', exportPathChooser(dialogs, now)),
    chooseImportPath: oneAtATime('import', importPathChooser(dialogs)),
  };
}
