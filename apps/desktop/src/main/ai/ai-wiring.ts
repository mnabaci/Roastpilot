import type { Logger } from '@roastpilot/core';
import type { AiSettings } from '@roastpilot/shared';
import { net, safeStorage } from 'electron';
import { open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import type { ChooseImportPath } from '../files/file-dialogs';
import type { IpcDeps } from '../ipc-deps';
import { AiKeyStore } from './ai-key-store';
import { AiService } from './ai-service';
import { claudeProvider } from './claude-reader';
import { jevProvider } from './jev-taste-reader';
import { AI_READ_LIMIT_MS } from './read-limits';

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
  // The providers, in Settings' order: a new one is a module and a line here.
  const providers = [claudeProvider(logger), jevProvider(logger)];
  const keys = new AiKeyStore({
    dir,
    providers: providers.map((provider) => provider.info.id),
    cipher: safeStorage,
    files: {
      read: (path) => readFile(path),
      write: (path, data) => writeFile(path, data, { mode: 0o600 }),
      rename,
      remove: (path) => rm(path),
    },
    logger,
  });
  const reads = new AiService({
    settings,
    keys,
    providers,
    files: {
      choosePdf: (parent) => chooseImportPath('spec-sheet', parent),
      sizeOf: async (path) => (await stat(path)).size,
      readBytes: async (path, limit) => {
        const file = await open(path, 'r');
        try {
          const buffer = new Uint8Array(limit);
          const { bytesRead } = await file.read(buffer, 0, limit, 0);
          return buffer.subarray(0, bytesRead);
        } finally {
          await file.close();
        }
      },
    },
    // Chromium's own fetch: the shop sees a browser, with its proxy and certificates.
    fetchPage: (url, init) => net.fetch(url, init),
    logger,
    deadline: () => AbortSignal.timeout(AI_READ_LIMIT_MS),
    now: () => Date.now(),
  });
  return { keys, reads };
}
