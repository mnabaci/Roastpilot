import {
  ok,
  type ExportLibraryError,
  type ExportLibraryRequest,
  type ExportLibraryResult,
  type ImportLibraryError,
  type ImportLibraryResult,
  type LibraryKind,
  type Result,
} from '@roastpilot/shared';
import { basename } from 'node:path';
import type { ChooseExportPath, ChooseImportPath, DialogParent } from './file-dialogs';
import type { LibraryFiles } from './library-kind';
import { readPicked, writePicked, type PickedFileDeps } from './picked-file';

export interface LibraryFileActionsDeps extends PickedFileDeps {
  /** Each kind's files, registered at startup. */
  kinds: Readonly<Record<LibraryKind, LibraryFiles>>;
  /** The file you picked, in a dialog on `parent`; undefined if you cancelled. */
  chooseExportPath: ChooseExportPath;
  chooseImportPath: ChooseImportPath;
}

/** Each opens its file dialog on `parent`, the window that asked. */
export interface LibraryFileActions {
  exportLibrary: (
    request: ExportLibraryRequest,
    parent: DialogParent,
  ) => Promise<Result<ExportLibraryResult, ExportLibraryError>>;
  importLibrary: (
    kind: LibraryKind,
    parent: DialogParent,
  ) => Promise<Result<ImportLibraryResult, ImportLibraryError>>;
}

/**
 * The Beans, Profiles and Roasters screens' file actions (docs/spec/data-model.md, Beans, profiles
 * and roasters files): main picks the paths, so the renderer never names a file.
 */
export function createLibraryFileActions(deps: LibraryFileActionsDeps): LibraryFileActions {
  const { kinds, chooseExportPath, chooseImportPath } = deps;
  return {
    exportLibrary: async ({ kind, ids }, parent) => {
      const path = await chooseExportPath(kind, 'roastpilot', ids ? ids.length : 'all', parent);
      if (path === undefined) return ok({ status: 'cancelled' });
      const text = await kinds[kind].exportFile(ids);
      if (!text.ok) return text;
      const written = await writePicked(path, text.value, deps, 'files.export-write-failed');
      return written.ok ? ok({ status: 'saved', fileName: basename(path) }) : written;
    },
    importLibrary: async (kind, parent) => {
      const path = await chooseImportPath(kind, parent);
      if (path === undefined) return ok({ status: 'cancelled' });
      const text = await readPicked(path, deps, 'files.import-read-failed');
      if (!text.ok) return text;
      const imported = await kinds[kind].importFile(text.value);
      return imported.ok ? ok({ status: 'imported', ...imported.value }) : imported;
    },
  };
}
