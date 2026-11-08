import { serializeError, silentLogger, type Logger, type SettingsStore } from '@roastpilot/core';
import {
  DEFAULT_SETTINGS,
  err,
  ok,
  SettingsSchema,
  SOAK_LENGTHS_S,
  type Result,
  type Settings,
  type SettingsWriteError,
} from '@roastpilot/shared';
import { readFile, rename, writeFile } from 'node:fs/promises';
import type { RetiredSoakSetting } from './move-soak';

/** The old Soak time setting, read leniently: a length it never offered counts as none. */
function retiredSoakOf(json: object): number | undefined {
  const value = 'soakTimeS' in json ? json.soakTimeS : undefined;
  return SOAK_LENGTHS_S.find((lengthS) => lengthS === value);
}

const isMissing = (error: unknown) =>
  (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';

/**
 * Settings in one JSON file (docs/spec/ui.md, Settings). Writes go to a temp file first and are
 * renamed into place, so a crash mid-save never leaves a half-written file. A file that can't be
 * read is moved aside (never overwritten) and the defaults are used. The old Soak time setting is
 * kept in the file until it has moved into the profiles.
 */
export class JsonSettingsStore implements SettingsStore, RetiredSoakSetting {
  readonly #path: string;
  readonly #logger: Logger;
  readonly #now: () => Date;
  #retiredSoakS: number | undefined;

  constructor(path: string, options: { logger?: Logger; now?: () => Date } = {}) {
    this.#path = path;
    this.#logger = options.logger ?? silentLogger;
    this.#now = options.now ?? (() => new Date());
  }

  async load(): Promise<Settings> {
    let text: string;
    try {
      text = await readFile(this.#path, 'utf8');
    } catch (error) {
      if (!isMissing(error))
        this.#logger.warn('settings.read-failed', {
          path: this.#path,
          error: serializeError(error),
        });
      return DEFAULT_SETTINGS;
    }
    const parsed = this.#parse(text);
    if (parsed) return parsed;
    await this.#moveAside();
    return DEFAULT_SETTINGS;
  }

  async save(settings: Settings): Promise<Result<void, SettingsWriteError>> {
    const temp = `${this.#path}.tmp`;
    const kept = this.#retiredSoakS === undefined ? {} : { soakTimeS: this.#retiredSoakS };
    try {
      await writeFile(temp, `${JSON.stringify({ ...settings, ...kept }, null, 2)}\n`, 'utf8');
      await rename(temp, this.#path);
      return ok(undefined);
    } catch (error) {
      this.#logger.error('settings.write-failed', {
        path: this.#path,
        error: serializeError(error),
      });
      return err({
        kind: 'write-failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  retiredSoakS(): number | undefined {
    return this.#retiredSoakS;
  }

  forgetRetiredSoak(): void {
    this.#retiredSoakS = undefined;
  }

  #parse(text: string): Settings | undefined {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return undefined; // Not JSON at all: handled by the caller like any other unreadable file.
    }
    const result = SettingsSchema.safeParse(json);
    if (!result.success || typeof json !== 'object' || json === null) return undefined;
    this.#retiredSoakS = retiredSoakOf(json);
    return result.data;
  }

  async #moveAside(): Promise<void> {
    const aside = `${this.#path}.broken-${this.#now().toISOString().replace(/[:.]/g, '-')}`;
    try {
      await rename(this.#path, aside);
      this.#logger.warn('settings.unreadable-moved-aside', { path: this.#path, movedTo: aside });
    } catch (error) {
      this.#logger.error('settings.move-aside-failed', {
        path: this.#path,
        error: serializeError(error),
      });
    }
  }
}
