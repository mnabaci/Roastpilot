import { serializeError, silentLogger, type Logger, type SettingsStore } from '@roastpilot/core';
import {
  DEFAULT_SETTINGS,
  err,
  ok,
  SettingsSchema,
  type Result,
  type Settings,
  type SettingsWriteError,
} from '@roastpilot/shared';
import { readFile, rename, writeFile } from 'node:fs/promises';

const isMissing = (error: unknown) =>
  (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';

/**
 * Settings in one JSON file (docs/spec/ui.md, Settings). Writes go to a temp file first and are
 * renamed into place, so a crash mid-save never leaves a half-written file. A file that can't be
 * read is moved aside (never overwritten) and the defaults are used.
 */
export class JsonSettingsStore implements SettingsStore {
  readonly #path: string;
  readonly #logger: Logger;
  readonly #now: () => Date;

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
    try {
      await writeFile(temp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
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

  #parse(text: string): Settings | undefined {
    try {
      const result = SettingsSchema.safeParse(JSON.parse(text));
      return result.success ? result.data : undefined;
    } catch {
      return undefined; // Not JSON at all: handled by the caller like any other unreadable file.
    }
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
