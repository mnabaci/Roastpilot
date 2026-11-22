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
import { readOrderPage, type FetchPage } from './order-page';
import { readSheetPdf, type SheetFiles } from './sheet-pdf';

export interface AiServiceDeps {
  /** The AI helpers' settings as they are now. */
  settings: () => Promise<AiSettings>;
  keys: Pick<AiKeyStore, 'read' | 'status'>;
  /** The registered providers, in the order Settings lists them. */
  providers: readonly AiProvider[];
  files: SheetFiles;
  /** Fetches a bean's order page, for Fill details › From the order page. */
  fetchPage: FetchPage;
  logger: Logger;
  /** A new read's hard stop, for every provider and model it asks (read-limits.ts). */
  deadline: () => AbortSignal;
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

  /** The providers that do `job`, the one chosen first, then in their order; keys not read. */
  #able<J extends 'taste' | 'specSheet'>(
    job: J,
    chosen: AiProviderId | null,
  ): { id: AiProviderId; reader: NonNullable<AiProvider[J]> }[] {
    return this.#deps.providers
      .toSorted((a, b) => Number(b.info.id === chosen) - Number(a.info.id === chosen))
      .flatMap((provider) => {
        const reader = provider[job];
        return reader ? [{ id: provider.info.id, reader }] : [];
      });
  }

  /** The first provider that does `job` and has a key now; undefined when none has. */
  async #firstReady(job: 'taste' | 'specSheet'): Promise<AiProviderId | undefined> {
    for (const { id } of this.#able(job, null))
      if ((await this.#deps.keys.read(id)) !== undefined) return id;
    return undefined;
  }

  /**
   * The read by the first provider with a key; by the next while one says all its models are
   * retired, so a retired model never stops a helper another key can still do. Before each, the
   * helpers must still be on and its key is read afresh: turning them off or removing a key
   * mid-read stops what hasn't been sent. One deadline covers every provider asked.
   */
  async #readWith<R, T>(
    able: readonly { id: AiProviderId; reader: R }[],
    read: (provider: Ready<R>, signal: AbortSignal) => Promise<Result<T, AiReadError>>,
  ): Promise<Result<T, AiReadError>> {
    const signal = this.#deps.deadline();
    let answer: Result<T, AiReadError> = err({ kind: 'no-key' });
    for (const { id, reader } of able) {
      if (!(await this.#deps.settings()).enabled) return err({ kind: 'off' });
      if (signal.aborted) return err({ kind: 'offline', provider: id });
      const key = await this.#deps.keys.read(id);
      if (key === undefined) continue;
      answer = await read({ id, reader, key }, signal);
      if (answer.ok || answer.error.kind !== 'model-retired') return answer;
    }
    return answer;
  }

  /** Your tasting words into tags, by the chosen provider, else the first that can. */
  readTaste(words: string): Promise<Result<TasteTag[], AiReadError>> {
    return this.#once('taste', async () => {
      const { enabled, tasteProvider } = await this.#deps.settings();
      if (!enabled) return err({ kind: 'off' });
      const read = await this.#readWith(this.#able('taste', tasteProvider), (picked, signal) =>
        this.#timed('taste', picked.id, words.length, () =>
          picked.reader.readTaste(words, picked.key, signal),
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
      const first = await this.#firstReady('specSheet');
      if (first === undefined) return err({ kind: 'no-key' });
      let sheet: SpecSheetSource;
      if (request.kind === 'text') {
        sheet = request;
      } else if (request.kind === 'page') {
        const page = await readOrderPage(request.url, this.#deps.fetchPage, this.#deps.logger);
        if (!page.ok) return page;
        sheet = { kind: 'text', text: page.value };
      } else {
        const pdf = await readSheetPdf(this.#deps.files, this.#deps.logger, parent, first);
        if (!pdf.ok) return pdf;
        if (pdf.value === undefined) return ok({ status: 'cancelled' });
        sheet = { kind: 'pdf', bytes: pdf.value };
      }
      const size = sheet.kind === 'text' ? sheet.text.length : sheet.bytes.length;
      const read = await this.#readWith(this.#able('specSheet', null), (picked, signal) =>
        this.#timed('spec-sheet', picked.id, size, () =>
          picked.reader.readSpecSheet(sheet, picked.key, signal),
        ),
      );
      const answered = await this.#stillOn(read);
      if (!answered.ok) return answered;
      const fields = specSheetFields(answered.value);
      if (isEmptySheet(fields)) this.#deps.logger.info('ai.sheet-empty', { kind: request.kind });
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
