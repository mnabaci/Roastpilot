import type { Logger } from '@roastpilot/core';
import type { AiSettings } from '@roastpilot/shared';
import { safeStorage } from 'electron';
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import type { ChooseImportPath } from '../files/file-dialogs';
import type { IpcDeps } from '../ipc-deps';
import { AiKeyStore } from './ai-key-store';
import { AiService } from './ai-service';
import { ClaudeReader } from './claude-reader';
import { JevTasteReader } from './jev-taste-reader';

/**
 * The AI helpers, made in main (docs/spec/ai-helpers.md, ADR 0027): keys in the user-data folder,
 * encrypted with the computer's keychain; Claude reads both jobs, Jev tasting words.
 */
export function aiWiring({
  dir,
  settings,
  chooseImportPath,
  logger,
}: {
  dir: string;
  settings: () => Promise<AiSettings>;
  chooseImportPath: ChooseImportPath;
  logger: Logger;
}): IpcDeps['ai'] {
  const keys = new AiKeyStore({
    dir,
    cipher: safeStorage,
    files: {
      read: (path) => readFile(path),
      write: (path, data) => writeFile(path, data, { mode: 0o600 }),
      rename,
      remove: (path) => rm(path),
    },
    logger,
  });
  const claude = new ClaudeReader(logger);
  const reads = new AiService({
    settings,
    keys,
    tasteReaders: { claude, jev: new JevTasteReader(logger) },
    sheetReader: claude,
    files: {
      choosePdf: (parent) => chooseImportPath('spec-sheet', parent),
      sizeOf: async (path) => (await stat(path)).size,
      readBytes: async (path) => new Uint8Array(await readFile(path)),
    },
    logger,
    now: () => Date.now(),
  });
  return { keys, reads };
}
