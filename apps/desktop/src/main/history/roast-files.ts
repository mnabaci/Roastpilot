import { serializeError, type Logger } from '@roastpilot/core';
import {
  err,
  ok,
  type ExportRoastsError,
  type ExportRoastsRequest,
  type ExportRoastsResult,
  type ImportArtisanError,
  type ImportArtisanResult,
  type ImportRoastsError,
  type ImportRoastsResult,
  type Result,
} from '@roastpilot/shared';
import { basename } from 'node:path';
import type { HistoryService } from './history-service';
import type { ChooseExportPath, ChooseImportPath, DialogParent } from './roast-file-dialogs';
import type { RoastFileService } from './roast-file-service';

export type ExportFormat = ExportRoastsRequest['format'];
export type ImportKind = 'roastpilot' | 'artisan';

export interface RoastFilesDeps {
  history: Pick<HistoryService, 'exportCsv' | 'importArtisan'>;
  files: Pick<RoastFileService, 'exportFile' | 'importFile'>;
  /** The file you picked, in a dialog on `parent`; undefined if you cancelled. */
  chooseExportPath: ChooseExportPath;
  chooseImportPath: ChooseImportPath;
  readText: (path: string) => Promise<string>;
  writeText: (path: string, text: string) => Promise<void>;
  logger: Logger;
}

/** Each opens its file dialog on `parent`, the window that asked. */
export interface RoastFiles {
  exportRoasts: (
    request: ExportRoastsRequest,
    parent: DialogParent,
  ) => Promise<Result<ExportRoastsResult, ExportRoastsError>>;
  importRoasts: (parent: DialogParent) => Promise<Result<ImportRoastsResult, ImportRoastsError>>;
  importArtisan: (parent: DialogParent) => Promise<Result<ImportArtisanResult, ImportArtisanError>>;
}

/** History's file actions: main picks the paths, so the renderer never names a file. */
export function createRoastFiles(deps: RoastFilesDeps): RoastFiles {
  const { history, files, chooseExportPath, chooseImportPath, readText, writeText, logger } = deps;
  /** The file's text, or why it couldn't be read; undefined when you cancelled. */
  const read = async (
    kind: ImportKind,
    parent: DialogParent,
  ): Promise<Result<string, { kind: 'read-failed' }> | undefined> => {
    const path = await chooseImportPath(kind, parent);
    if (path === undefined) return undefined;
    try {
      return ok(await readText(path));
    } catch (error) {
      logger.warn('history.import-read-failed', { error: serializeError(error) });
      return err({ kind: 'read-failed' });
    }
  };
  return {
    exportRoasts: async ({ format, ids }, parent) => {
      const path = await chooseExportPath(format, ids ? ids.length : 'all', parent);
      if (path === undefined) return ok({ status: 'cancelled' });
      const text = format === 'csv' ? await history.exportCsv(ids) : await files.exportFile(ids);
      if (!text.ok) return text;
      try {
        await writeText(path, text.value);
      } catch (error) {
        logger.warn('history.export-write-failed', { error: serializeError(error) });
        return err({ kind: 'write-failed' });
      }
      return ok({ status: 'saved', fileName: basename(path) });
    },
    importRoasts: async (parent) => {
      const text = await read('roastpilot', parent);
      if (text === undefined) return ok({ status: 'cancelled' });
      if (!text.ok) return text;
      const imported = await files.importFile(text.value);
      return imported.ok ? ok({ status: 'imported', ...imported.value }) : imported;
    },
    importArtisan: async (parent) => {
      const text = await read('artisan', parent);
      if (text === undefined) return ok({ status: 'cancelled' });
      if (!text.ok) return text;
      const imported = await history.importArtisan(text.value);
      return imported.ok ? ok({ status: 'imported', id: imported.value }) : imported;
    },
  };
}
