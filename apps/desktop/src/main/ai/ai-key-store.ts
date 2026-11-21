import { serializeError, type Logger } from '@roastpilot/core';
import {
  AI_PROVIDERS,
  err,
  ok,
  type AiKeyError,
  type AiKeys,
  type AiProvider,
  type Result,
} from '@roastpilot/shared';
import { join } from 'node:path';

/** Electron's `safeStorage`, as the store uses it: the computer's keychain. */
export interface KeyCipher {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

/** The files the keys live in, so tests can keep them in memory. */
export interface KeyFiles {
  read(path: string): Promise<Buffer>;
  /** Written readable by you alone. */
  write(path: string, data: Buffer): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

const isMissing = (error: unknown) =>
  (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';

/** The file a provider's key lives in (docs/spec/ai-helpers.md, Turning it on). */
export const keyFileName = (provider: AiProvider): string => `ai-key-${provider}.bin`;

/**
 * The AI providers' keys, each encrypted with the computer's keychain in its own file in the
 * user-data folder. A key only ever leaves here to its reader: the screen learns whether one is
 * saved and its last four characters. Writes run one at a time and go to a temp file first.
 */
export class AiKeyStore {
  readonly #dir: string;
  readonly #cipher: KeyCipher;
  readonly #files: KeyFiles;
  readonly #logger: Logger;
  #writing: Promise<unknown> = Promise.resolve();

  constructor(deps: { dir: string; cipher: KeyCipher; files: KeyFiles; logger: Logger }) {
    this.#dir = deps.dir;
    this.#cipher = deps.cipher;
    this.#files = deps.files;
    this.#logger = deps.logger;
  }

  /** The key, or undefined when none is saved or it can't be read (logged). */
  async read(provider: AiProvider): Promise<string | undefined> {
    let data: Buffer;
    try {
      data = await this.#files.read(this.#path(provider));
    } catch (error) {
      if (!isMissing(error))
        this.#logger.warn('ai.key-unreadable', { provider, error: serializeError(error) });
      return undefined;
    }
    try {
      const key = this.#cipher.decryptString(data);
      return key.length > 0 ? key : undefined;
    } catch (error) {
      // Another computer's or user's keychain: as good as no key. Saving a new one replaces it.
      this.#logger.warn('ai.key-unreadable', { provider, error: serializeError(error) });
      return undefined;
    }
  }

  /** Whether each provider has a key, and its last four characters. */
  async status(): Promise<AiKeys> {
    const entries = await Promise.all(
      AI_PROVIDERS.map(async (provider) => {
        const key = await this.read(provider);
        return [provider, { saved: key !== undefined, last4: key?.slice(-4) ?? null }] as const;
      }),
    );
    return Object.fromEntries(entries) as AiKeys;
  }

  /** Saves the key, replacing the one there; refused where the keychain can't encrypt it. */
  save(provider: AiProvider, key: string): Promise<Result<AiKeys, AiKeyError>> {
    return this.#queue(async () => {
      if (!this.#cipher.isEncryptionAvailable()) {
        this.#logger.warn('ai.key-not-saved', { provider, reason: 'unsafe-storage' });
        return err({ kind: 'unsafe-storage' });
      }
      const path = this.#path(provider);
      const temporary = `${path}.tmp`;
      try {
        await this.#files.write(temporary, this.#cipher.encryptString(key));
        await this.#files.rename(temporary, path);
      } catch (error) {
        this.#logger.warn('ai.key-not-saved', { provider, error: serializeError(error) });
        await this.#files.remove(temporary).catch((removeError: unknown) => {
          if (!isMissing(removeError))
            this.#logger.warn('files.temp-not-removed', { error: serializeError(removeError) });
        });
        return err({ kind: 'storage-failed', message: 'The key could not be saved' });
      }
      this.#logger.info('ai.key-saved', { provider });
      return ok(await this.status());
    });
  }

  /** Removes the key; one that isn't there is already removed. */
  remove(provider: AiProvider): Promise<Result<AiKeys, AiKeyError>> {
    return this.#queue(async () => {
      try {
        await this.#files.remove(this.#path(provider));
      } catch (error) {
        if (!isMissing(error)) {
          this.#logger.warn('ai.key-not-removed', { provider, error: serializeError(error) });
          return err({ kind: 'storage-failed', message: 'The key could not be removed' });
        }
      }
      this.#logger.info('ai.key-removed', { provider });
      return ok(await this.status());
    });
  }

  #path(provider: AiProvider): string {
    return join(this.#dir, keyFileName(provider));
  }

  /** One write at a time, so a quick Save then Remove never race over the files. */
  #queue<T>(write: () => Promise<T>): Promise<T> {
    const next = this.#writing.then(write, write);
    this.#writing = next.catch(() => undefined);
    return next;
  }
}
