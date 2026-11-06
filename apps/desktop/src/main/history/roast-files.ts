import { serializeError, type Logger } from '@roastpilot/core';
import {
  err,
  ok,
  type ExportRoastsError,
  type ExportRoastsResult,
  type ImportArtisanError,
  type ImportArtisanResult,
  type Result,
} from '@roastpilot/shared';
import { basename } from 'node:path';
import type { HistoryService } from './history-service';

export interface RoastFilesDeps {
  history: Pick<HistoryService, 'exportCsv' | 'importArtisan'>;
  /** The file you picked; undefined if you cancelled. */
  chooseExportPath: () => Promise<string | undefined>;
  chooseImportPath: () => Promise<string | undefined>;
  readText: (path: string) => Promise<string>;
  writeText: (path: string, text: string) => Promise<void>;
  logger: Logger;
}

export interface RoastFiles {
  exportCsv: () => Promise<Result<ExportRoastsResult, ExportRoastsError>>;
  importArtisan: () => Promise<Result<ImportArtisanResult, ImportArtisanError>>;
}

/** History's file buttons: main picks the paths, so the renderer never names a file. */
export function createRoastFiles(deps: RoastFilesDeps): RoastFiles {
  const { history, chooseExportPath, chooseImportPath, readText, writeText, logger } = deps;
  return {
    exportCsv: async () => {
      const path = await chooseExportPath();
      if (path === undefined) return ok({ status: 'cancelled' });
      const csv = await history.exportCsv();
      if (!csv.ok) return csv;
      try {
        await writeText(path, csv.value);
      } catch (error) {
        logger.warn('history.export-write-failed', { error: serializeError(error) });
        return err({ kind: 'write-failed' });
      }
      return ok({ status: 'saved', fileName: basename(path) });
    },
    importArtisan: async () => {
      const path = await chooseImportPath();
      if (path === undefined) return ok({ status: 'cancelled' });
      let text: string;
      try {
        text = await readText(path);
      } catch (error) {
        logger.warn('history.import-read-failed', { error: serializeError(error) });
        return err({ kind: 'read-failed' });
      }
      const imported = await history.importArtisan(text);
      return imported.ok ? ok({ status: 'imported', id: imported.value }) : imported;
    },
  };
}
