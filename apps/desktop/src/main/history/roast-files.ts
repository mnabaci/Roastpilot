import {
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
import type {
  ChooseExportPath,
  ChooseImportPath,
  DialogParent,
  ImportKind,
} from '../files/file-dialogs';
import { readPicked, writePicked, type PickedFileDeps } from '../files/picked-file';
import type { HistoryService } from './history-service';
import type { RoastFileService } from './roast-file-service';

export interface RoastFilesDeps extends PickedFileDeps {
  history: Pick<HistoryService, 'exportCsv' | 'importArtisan'>;
  files: Pick<RoastFileService, 'exportFile' | 'importFile'>;
  /** The file you picked, in a dialog on `parent`; undefined if you cancelled. */
  chooseExportPath: ChooseExportPath;
  chooseImportPath: ChooseImportPath;
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
  const { history, files, chooseExportPath, chooseImportPath } = deps;
  /** The file's text, or why it couldn't be read; undefined when you cancelled. */
  const read = async (kind: ImportKind, parent: DialogParent) => {
    const path = await chooseImportPath(kind, parent);
    return path === undefined ? undefined : readPicked(path, deps, 'history.import-read-failed');
  };
  return {
    exportRoasts: async ({ format, ids }, parent) => {
      const path = await chooseExportPath('roasts', format, ids ? ids.length : 'all', parent);
      if (path === undefined) return ok({ status: 'cancelled' });
      const text = format === 'csv' ? await history.exportCsv(ids) : await files.exportFile(ids);
      if (!text.ok) return text;
      const written = await writePicked(path, text.value, deps, 'history.export-write-failed');
      return written.ok ? ok({ status: 'saved', fileName: basename(path) }) : written;
    },
    importRoasts: async (parent) => {
      const text = await read('roasts', parent);
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
