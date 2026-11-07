import { describe, expect, it, vi } from 'vitest';
import {
  exportDialog,
  exportPathChooser,
  importDialog,
  importPathChooser,
  ROAST_FILE_EXTENSION,
} from './roast-file-dialogs';

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

  it('export returns the picked path, with the dialog set up for the format and count', async () => {
    const dialogs = saveDialog({ canceled: false, filePath: '/tmp/out.csv' });
    const choose = exportPathChooser(dialogs, () => DAY);
    await expect(choose('csv', 3)).resolves.toBe('/tmp/out.csv');
    expect(dialogs.showSaveDialog).toHaveBeenCalledWith(exportDialog('csv', 3, DAY));
  });

  it('a cancelled export, or one with no path, is undefined', async () => {
    const choose = (result: { canceled: boolean; filePath: string }) =>
      exportPathChooser(saveDialog(result), () => DAY)('roastpilot', 'all');
    await expect(choose({ canceled: true, filePath: '' })).resolves.toBeUndefined();
    await expect(choose({ canceled: false, filePath: '' })).resolves.toBeUndefined();
  });

  it('import returns the one file picked, from an open-file dialog', async () => {
    const dialogs = openDialog({ canceled: false, filePaths: ['/tmp/a.alog'] });
    await expect(importPathChooser(dialogs)('artisan')).resolves.toBe('/tmp/a.alog');
    expect(dialogs.showOpenDialog).toHaveBeenCalledWith({
      ...importDialog('artisan'),
      properties: ['openFile'],
    });
  });

  it('a cancelled import, or one with no file, is undefined', async () => {
    const choose = (result: { canceled: boolean; filePaths: string[] }) =>
      importPathChooser(openDialog(result))('roastpilot');
    await expect(choose({ canceled: true, filePaths: [] })).resolves.toBeUndefined();
    await expect(choose({ canceled: false, filePaths: [] })).resolves.toBeUndefined();
  });
});
