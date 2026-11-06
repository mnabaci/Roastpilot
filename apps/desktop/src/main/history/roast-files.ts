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
import type { RoastFileService } from './roast-file-service';

export type ExportFormat = ExportRoastsRequest['format'];
export type ImportKind = 'roastpilot' | 'artisan';

export interface RoastFilesDeps {
  history: Pick<HistoryService, 'exportCsv' | 'importArtisan'>;
  files: Pick<RoastFileService, 'exportFile' | 'importFile'>;
  /** The file you picked; undefined if you cancelled. */
  chooseExportPath: (format: ExportFormat, count: number | 'all') => Promise<string | undefined>;
  chooseImportPath: (kind: ImportKind) => Promise<string | undefined>;
  readText: (path: string) => Promise<string>;
  writeText: (path: string, text: string) => Promise<void>;
  logger: Logger;
}

export interface RoastFiles {
  exportRoasts: (
    request: ExportRoastsRequest,
  ) => Promise<Result<ExportRoastsResult, ExportRoastsError>>;
  importRoasts: () => Promise<Result<ImportRoastsResult, ImportRoastsError>>;
  importArtisan: () => Promise<Result<ImportArtisanResult, ImportArtisanError>>;
}

/** History's file actions: main picks the paths, so the renderer never names a file. */
export function createRoastFiles(deps: RoastFilesDeps): RoastFiles {
  const { history, files, chooseExportPath, chooseImportPath, readText, writeText, logger } = deps;
  /** The file's text, or why it couldn't be read; undefined when you cancelled. */
  const read = async (
    kind: ImportKind,
  ): Promise<Result<string, { kind: 'read-failed' }> | undefined> => {
    const path = await chooseImportPath(kind);
    if (path === undefined) return undefined;
    try {
      return ok(await readText(path));
    } catch (error) {
      logger.warn('history.import-read-failed', { error: serializeError(error) });
      return err({ kind: 'read-failed' });
    }
  };
  return {
    exportRoasts: async ({ format, ids }) => {
      const path = await chooseExportPath(format, ids ? ids.length : 'all');
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
    importRoasts: async () => {
      const text = await read('roastpilot');
      if (text === undefined) return ok({ status: 'cancelled' });
      if (!text.ok) return text;
      const imported = await files.importFile(text.value);
      return imported.ok ? ok({ status: 'imported', ...imported.value }) : imported;
    },
    importArtisan: async () => {
      const text = await read('artisan');
      if (text === undefined) return ok({ status: 'cancelled' });
      if (!text.ok) return text;
      const imported = await history.importArtisan(text.value);
      return imported.ok ? ok({ status: 'imported', id: imported.value }) : imported;
    },
  };
}
