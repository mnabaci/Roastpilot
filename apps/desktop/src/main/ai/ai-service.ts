import { isEmptySheet, specSheetFields, type Logger, type SpecSheetSource } from '@roastpilot/core';
import {
  err,
  ok,
  type AiProviderEntry,
  type AiProviderId,
  type AiReadError,
  type AiSettings,
  type ReadSpecSheetRequest,
  type ReadSpecSheetResult,
  type Result,
  type TasteTag,
} from '@roastpilot/shared';
import type { DialogParent } from '../files/file-dialogs';
import type { AiKeyStore } from './ai-key-store';
import { providerEntries, type AiProvider } from './ai-provider';
import { readSheetPdf, type SheetFiles } from './sheet-pdf';

export interface AiServiceDeps {
  /** The AI helpers' settings as they are now. */
  settings: () => Promise<AiSettings>;
  keys: Pick<AiKeyStore, 'read' | 'status'>;
  /** The registered providers, in the order Settings lists them. */
  providers: readonly AiProvider[];
  files: SheetFiles;
  logger: Logger;
  /** Milliseconds, for how long a read took (logged). */
  now: () => number;
}

/** A provider ready to read a job: its reader, and its key. */
interface Ready<R> {
  id: AiProviderId;
  reader: R;
  key: string;
}

/**
 * The AI helpers (docs/spec/ai-helpers.md): checks they are on and have a key, picks the reader,
 * keeps to the limits, and runs one read of each kind at a time.
 */
export class AiService {
  readonly #deps: AiServiceDeps;
  readonly #busy = new Set<'taste' | 'spec-sheet'>();

  constructor(deps: AiServiceDeps) {
    this.#deps = deps;
  }

  /** The registered providers with their keys' status, as Settings lists them. */
  async list(): Promise<AiProviderEntry[]> {
    return providerEntries(this.#deps.providers, await this.#deps.keys.status());
  }

  /** The providers that do `job` and have a key, the one chosen first, then in their order. */
  async #ready<J extends 'taste' | 'specSheet'>(
    job: J,
    chosen: AiProviderId | null,
  ): Promise<Ready<NonNullable<AiProvider[J]>>[]> {
    const providers = this.#deps.providers.toSorted(
      (a, b) => Number(b.info.id === chosen) - Number(a.info.id === chosen),
    );
    const ready = [];
    for (const provider of providers) {
      const reader = provider[job];
      if (!reader) continue;
      const key = await this.#deps.keys.read(provider.info.id);
      if (key !== undefined) ready.push({ id: provider.info.id, reader, key });
    }
    return ready;
  }

  /**
   * The read by the first ready provider; by the next while one says all its models are retired,
   * so a retired model never stops a helper another key can still do.
   */
  async #readWith<R, T>(
    ready: readonly Ready<R>[],
    read: (provider: Ready<R>) => Promise<Result<T, AiReadError>>,
  ): Promise<Result<T, AiReadError>> {
    let answer: Result<T, AiReadError> = err({ kind: 'no-key' });
    for (const provider of ready) {
      answer = await read(provider);
      if (answer.ok || answer.error.kind !== 'model-retired') return answer;
    }
    return answer;
  }

  /** Your tasting words into tags, by the chosen provider, else the first that can. */
  readTaste(words: string): Promise<Result<TasteTag[], AiReadError>> {
    return this.#once('taste', async () => {
      const { enabled, tasteProvider } = await this.#deps.settings();
      if (!enabled) return err({ kind: 'off' });
      const ready = await this.#ready('taste', tasteProvider);
      const read = await this.#readWith(ready, (picked) =>
        this.#timed('taste', picked.id, words.length, () =>
          picked.reader.readTaste(words, picked.key),
        ),
      );
      return this.#stillOn(read);
    });
  }

  /** A spec sheet into bean fields: pasted text, or a PDF you pick in a dialog on `parent`. */
  readSpecSheet(
    request: ReadSpecSheetRequest,
    parent: DialogParent,
  ): Promise<Result<ReadSpecSheetResult, AiReadError>> {
    return this.#once('spec-sheet', async (): Promise<Result<ReadSpecSheetResult, AiReadError>> => {
      if (!(await this.#deps.settings()).enabled) return err({ kind: 'off' });
      const ready = await this.#ready('specSheet', null);
      const [first] = ready;
      if (!first) return err({ kind: 'no-key' });
      let sheet: SpecSheetSource;
      if (request.kind === 'text') {
        sheet = request;
      } else {
        const pdf = await readSheetPdf(this.#deps.files, this.#deps.logger, parent, first.id);
        if (!pdf.ok) return pdf;
        if (pdf.value === undefined) return ok({ status: 'cancelled' });
        sheet = { kind: 'pdf', bytes: pdf.value };
      }
      const size = sheet.kind === 'text' ? sheet.text.length : sheet.bytes.length;
      const read = await this.#readWith(ready, (picked) =>
        this.#timed('spec-sheet', picked.id, size, () =>
          picked.reader.readSpecSheet(sheet, picked.key),
        ),
      );
      const answered = await this.#stillOn(read);
      if (!answered.ok) return answered;
      const fields = specSheetFields(answered.value);
      if (isEmptySheet(fields)) this.#deps.logger.info('ai.sheet-empty', { kind: sheet.kind });
      return ok({ status: 'read', fields });
    });
  }

  /** An answer that came after the AI helpers were turned off is dropped. */
  async #stillOn<T>(read: Result<T, AiReadError>): Promise<Result<T, AiReadError>> {
    if ((await this.#deps.settings()).enabled) return read;
    this.#deps.logger.info('ai.read-dropped', { reason: 'turned-off' });
    return err({ kind: 'off' });
  }

  /** The read, logged with how big it was and how long it took; never what was sent. */
  async #timed<T>(
    helper: 'taste' | 'spec-sheet',
    provider: AiProviderId,
    size: number,
    read: () => Promise<Result<T, AiReadError>>,
  ): Promise<Result<T, AiReadError>> {
    const started = this.#deps.now();
    const result = await read();
    this.#deps.logger.debug('ai.read', {
      helper,
      provider,
      size,
      ok: result.ok,
      durationMs: this.#deps.now() - started,
    });
    return result;
  }

  /** One read of each kind at a time: a second while one runs is refused as busy. */
  async #once<T>(
    helper: 'taste' | 'spec-sheet',
    run: () => Promise<Result<T, AiReadError>>,
  ): Promise<Result<T, AiReadError>> {
    if (this.#busy.has(helper)) return err({ kind: 'busy' });
    this.#busy.add(helper);
    try {
      return await run();
    } finally {
      this.#busy.delete(helper);
    }
  }
}
