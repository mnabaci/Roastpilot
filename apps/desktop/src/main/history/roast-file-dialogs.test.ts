import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  exportDialog,
  exportPathChooser,
  importDialog,
  importPathChooser,
  pathChoosers,
  ROAST_FILE_EXTENSION,
  type DialogParent,
} from './roast-file-dialogs';

/** The window that asked: dialogs open on it (a sheet on macOS). */
const WINDOW = { id: 1 } as unknown as DialogParent;

const DAY = new Date('2026-11-06T14:00:00.000Z');

describe('roast file dialogs', () => {
  it('a Roastpilot export is a .rpr file, named for what it holds and the day', () => {
    expect(ROAST_FILE_EXTENSION).toBe('rpr');
    expect(exportDialog('roastpilot', 'all', DAY)).toEqual({
      title: 'Export all roasts',
      defaultPath: 'Roastpilot roasts 2026-11-06.rpr',
      filters: [{ name: 'Roastpilot roasts', extensions: ['rpr'] }],
    });
    expect(exportDialog('roastpilot', 1, DAY)).toMatchObject({
      title: 'Export 1 roast',
      defaultPath: 'Roastpilot roast 2026-11-06.rpr',
    });
  });

  it('a CSV export stays a .csv', () => {
    expect(exportDialog('csv', 3, DAY)).toEqual({
      title: 'Export 3 roasts',
      defaultPath: 'Roastpilot roasts 2026-11-06.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
  });

  it('import opens .rpr files; Artisan import opens .alog', () => {
    expect(importDialog('roastpilot')).toEqual({
      title: 'Import Roastpilot roasts',
      filters: [{ name: 'Roastpilot roasts', extensions: ['rpr'] }],
    });
    expect(importDialog('artisan')).toEqual({
      title: 'Import an Artisan roast',
      filters: [{ name: 'Artisan roast', extensions: ['alog'] }],
    });
  });
});

describe('path choosers', () => {
  const saveDialog = (result: { canceled: boolean; filePath: string }) => ({
    showSaveDialog: vi.fn(() => Promise.resolve(result)),
  });
  const openDialog = (result: { canceled: boolean; filePaths: string[] }) => ({
    showOpenDialog: vi.fn(() => Promise.resolve(result)),
  });

  it('export returns the picked path, from a dialog on the window that asked', async () => {
    const dialogs = saveDialog({ canceled: false, filePath: '/tmp/out.csv' });
    const choose = exportPathChooser(dialogs, () => DAY);
    await expect(choose('csv', 3, WINDOW)).resolves.toBe('/tmp/out.csv');
    expect(dialogs.showSaveDialog).toHaveBeenCalledWith(WINDOW, exportDialog('csv', 3, DAY));
  });

  it('a cancelled export, or one with no path, is undefined', async () => {
    const choose = (result: { canceled: boolean; filePath: string }) =>
      exportPathChooser(saveDialog(result), () => DAY)('roastpilot', 'all', WINDOW);
    await expect(choose({ canceled: true, filePath: '' })).resolves.toBeUndefined();
    await expect(choose({ canceled: false, filePath: '' })).resolves.toBeUndefined();
  });

  it('import returns the one file picked, from an open-file dialog', async () => {
    const dialogs = openDialog({ canceled: false, filePaths: ['/tmp/a.alog'] });
    await expect(importPathChooser(dialogs)('artisan', WINDOW)).resolves.toBe('/tmp/a.alog');
    expect(dialogs.showOpenDialog).toHaveBeenCalledWith(WINDOW, {
      ...importDialog('artisan'),
      properties: ['openFile'],
    });
  });

  it('a cancelled import, or one with no file, is undefined', async () => {
    const choose = (result: { canceled: boolean; filePaths: string[] }) =>
      importPathChooser(openDialog(result))('roastpilot', WINDOW);
    await expect(choose({ canceled: true, filePaths: [] })).resolves.toBeUndefined();
    await expect(choose({ canceled: false, filePaths: [] })).resolves.toBeUndefined();
  });
});

describe('one file dialog at a time', () => {
  /** Dialogs that stay open until `close` is called with what you picked. */
  function heldDialogs() {
    let close: (path: string) => void = () => undefined;
    const held = () =>
      new Promise<string>((resolve) => {
        close = resolve;
      });
    const dialogs = {
      showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: await held() })),
      showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: [await held()] })),
    };
    const entries: LogEntry[] = [];
    const choosers = pathChoosers({
      dialogs,
      now: () => DAY,
      logger: createLogger({ write: (e) => entries.push(e) }, 'history'),
    });
    return {
      dialogs,
      choosers,
      entries,
      close: (path: string) => {
        close(path);
      },
    };
  }

  it('a second ask while one is open is cancelled, logged, and opens nothing', async () => {
    const { dialogs, choosers, entries, close } = heldDialogs();
    const first = choosers.chooseExportPath('csv', 'all', WINDOW);
    await expect(choosers.chooseExportPath('csv', 'all', WINDOW)).resolves.toBeUndefined();
    await expect(choosers.chooseImportPath('artisan', WINDOW)).resolves.toBeUndefined();
    expect(dialogs.showSaveDialog).toHaveBeenCalledTimes(1);
    expect(dialogs.showOpenDialog).not.toHaveBeenCalled();
    expect(entries.map((e) => [e.event, e.context?.dialog])).toEqual([
      ['history.dialog-already-open', 'export'],
      ['history.dialog-already-open', 'import'],
    ]);
    close('/tmp/out.csv');
    await expect(first).resolves.toBe('/tmp/out.csv');
  });

  it('once the dialog closes, the next ask opens one', async () => {
    const { dialogs, choosers, close } = heldDialogs();
    const first = choosers.chooseImportPath('roastpilot', WINDOW);
    close('/tmp/a.rpr');
    await first;
    const second = choosers.chooseImportPath('roastpilot', WINDOW);
    close('/tmp/b.rpr');
    await expect(second).resolves.toBe('/tmp/b.rpr');
    expect(dialogs.showOpenDialog).toHaveBeenCalledTimes(2);
  });

  it('a dialog that fails frees the way for the next one', async () => {
    const dialogs = {
      showSaveDialog: vi
        .fn()
        .mockRejectedValueOnce(new Error('no window'))
        .mockResolvedValue({ canceled: true, filePath: '' }),
      showOpenDialog: vi.fn(),
    };
    const { chooseExportPath } = pathChoosers({
      dialogs,
      now: () => DAY,
      logger: createLogger({ write: () => undefined }, 'history'),
    });
    await expect(chooseExportPath('csv', 1, WINDOW)).rejects.toThrow('no window');
    await expect(chooseExportPath('csv', 1, WINDOW)).resolves.toBeUndefined();
    expect(dialogs.showSaveDialog).toHaveBeenCalledTimes(2);
  });
});
