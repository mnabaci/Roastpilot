import { describe, expect, it } from 'vitest';
import { exportDialog, importDialog, ROAST_FILE_EXTENSION } from './roast-file-dialogs';

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
