import {
  isEmptySheet,
  serializeError,
  specSheetFields,
  type Logger,
  type SpecSheetReader,
  type SpecSheetSource,
  type TasteReader,
} from '@roastpilot/core';
import {
  AI_PROVIDERS,
  err,
  ok,
  SPEC_SHEET_PDF_MAX_BYTES,
  SPEC_SHEET_PDF_MAX_PAGES,
  SPEC_SHEET_PROVIDER,
  type AiProvider,
  type AiReadError,
  type AiSettings,
  type ReadSpecSheetRequest,
  type ReadSpecSheetResult,
  type Result,
  type TasteTag,
} from '@roastpilot/shared';
import type { DialogParent } from '../files/file-dialogs';
import type { AiKeyStore } from './ai-key-store';

/** Reading the PDF you picked, the file system injected. */
export interface SheetFiles {
  /** The PDF you pick in a dialog on `parent`; undefined when you cancel. */
  choosePdf: (parent: DialogParent) => Promise<string | undefined>;
  sizeOf: (path: string) => Promise<number>;
  readBytes: (path: string) => Promise<Uint8Array>;
}

export interface AiServiceDeps {
  /** The AI helpers' settings as they are now. */
  settings: () => Promise<AiSettings>;
  keys: Pick<AiKeyStore, 'read'>;
  /** The taste reader of each provider that has one. */
  tasteReaders: Partial<Record<AiProvider, TasteReader>>;
  sheetReader: SpecSheetReader;
  files: SheetFiles;
  logger: Logger;
  /** Milliseconds, for how long a read took (logged). */
  now: () => number;
}

/** A PDF file starts with these bytes. */
const PDF_MAGIC = '%PDF-';

/**
 * The pages a PDF says it has: its page objects, counted. A PDF that packs its objects into
 * compressed streams shows none here, and is sent: Claude's own limit still applies.
 */
export function pdfPageCount(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString('latin1');
  return text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
}

const isPdf = (bytes: Uint8Array): boolean =>
  Buffer.from(bytes.subarray(0, PDF_MAGIC.length)).toString('latin1') === PDF_MAGIC;

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

  /** Your tasting words into tags, by the chosen provider, or the other when it has no key. */
  readTaste(words: string): Promise<Result<TasteTag[], AiReadError>> {
    return this.#once('taste', async () => {
      const { enabled, tasteProvider } = await this.#deps.settings();
      if (!enabled) return err({ kind: 'off' });
      const order = [tasteProvider, ...AI_PROVIDERS.filter((p) => p !== tasteProvider)];
      for (const provider of order) {
        const reader = this.#deps.tasteReaders[provider];
        if (!reader) continue;
        const key = await this.#deps.keys.read(provider);
        if (key === undefined) continue;
        return this.#timed('taste', provider, words.length, () => reader.readTaste(words, key));
      }
      return err({ kind: 'no-key', provider: tasteProvider });
    });
  }

  /** A spec sheet into bean fields: pasted text, or a PDF you pick in a dialog on `parent`. */
  readSpecSheet(
    request: ReadSpecSheetRequest,
    parent: DialogParent,
  ): Promise<Result<ReadSpecSheetResult, AiReadError>> {
    return this.#once('spec-sheet', async (): Promise<Result<ReadSpecSheetResult, AiReadError>> => {
      if (!(await this.#deps.settings()).enabled) return err({ kind: 'off' });
      const provider = SPEC_SHEET_PROVIDER;
      const key = await this.#deps.keys.read(provider);
      if (key === undefined) return err({ kind: 'no-key', provider });
      let sheet: SpecSheetSource;
      if (request.kind === 'text') {
        sheet = request;
      } else {
        const picked = await this.#readPdf(parent);
        if (!picked.ok) return picked;
        if (picked.value === undefined) return ok({ status: 'cancelled' });
        sheet = { kind: 'pdf', bytes: picked.value };
      }
      const size = sheet.kind === 'text' ? sheet.text.length : sheet.bytes.length;
      const read = await this.#timed('spec-sheet', provider, size, () =>
        this.#deps.sheetReader.readSpecSheet(sheet, key),
      );
      if (!read.ok) return read;
      const fields = specSheetFields(read.value);
      if (isEmptySheet(fields)) this.#deps.logger.info('ai.sheet-empty', { kind: sheet.kind });
      return ok({ status: 'read', fields });
    });
  }

  /** The PDF's bytes; undefined when you cancelled; refused over the limits or not a PDF. */
  async #readPdf(parent: DialogParent): Promise<Result<Uint8Array | undefined, AiReadError>> {
    const { files, logger } = this.#deps;
    const path = await files.choosePdf(parent);
    if (path === undefined) return ok(undefined);
    let bytes: Uint8Array;
    try {
      if ((await files.sizeOf(path)) > SPEC_SHEET_PDF_MAX_BYTES)
        return err({ kind: 'too-long', limit: '10 MB' });
      bytes = await files.readBytes(path);
    } catch (error) {
      logger.warn('ai.sheet-read-failed', { error: serializeError(error) });
      return err({ kind: 'failed', provider: SPEC_SHEET_PROVIDER });
    }
    if (!isPdf(bytes)) {
      logger.info('ai.sheet-not-pdf', { bytes: bytes.length });
      return err({ kind: 'unreadable', provider: SPEC_SHEET_PROVIDER });
    }
    if (pdfPageCount(bytes) > SPEC_SHEET_PDF_MAX_PAGES)
      return err({ kind: 'too-long', limit: `${String(SPEC_SHEET_PDF_MAX_PAGES)} pages` });
    return ok(bytes);
  }

  /** The read, logged with how big it was and how long it took; never what was sent. */
  async #timed<T>(
    helper: 'taste' | 'spec-sheet',
    provider: AiProvider,
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
