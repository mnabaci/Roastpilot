import {
  isEmptySheet,
  serializeError,
  specSheetFields,
  type Logger,
  type SpecSheetSource,
} from '@roastpilot/core';
import {
  err,
  ok,
  SPEC_SHEET_PDF_MAX_BYTES,
  SPEC_SHEET_PDF_MAX_PAGES,
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

/** Reading the PDF you picked, the file system injected. */
export interface SheetFiles {
  /** The PDF you pick in a dialog on `parent`; undefined when you cancel. */
  choosePdf: (parent: DialogParent) => Promise<string | undefined>;
  sizeOf: (path: string) => Promise<number>;
  /** At most `limit` bytes, so a file that grew after `sizeOf` is never read whole. */
  readBytes: (path: string, limit: number) => Promise<Uint8Array>;
}

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

/** A PDF file starts with these bytes. */
const PDF_MAGIC = '%PDF-';

/**
 * The pages a PDF says it has: its page objects, counted. A PDF that packs its objects into
 * compressed streams shows none here, and is sent: Claude's own limit still applies.
 */
export function pdfPageCount(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString('latin1');
  // The page tree's root says how many pages there are (/Type /Pages … /Count n). A file saved
  // with changes repeats it, so the largest is the document's; it is never counted twice.
  const counts = [...text.matchAll(/<<(?:(?!<<|>>)[\s\S])*?>>/g)]
    .map(([dictionary]) => dictionary)
    .filter((dictionary) => /\/Type\s*\/Pages(?![a-zA-Z])/.test(dictionary))
    .map((dictionary) => Number(/\/Count\s+(\d+)/.exec(dictionary)?.[1] ?? 0));
  if (counts.length > 0) return Math.max(...counts);
  // No page tree in plain sight: count the page objects.
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

  /** The registered providers with their keys' status, as Settings lists them. */
  async list(): Promise<AiProviderEntry[]> {
    return providerEntries(this.#deps.providers, await this.#deps.keys.status());
  }

  /**
   * The provider that does `job` and has a key: the one chosen first, then the rest in their
   * order; undefined when none does.
   */
  async #pick<J extends 'taste' | 'specSheet'>(
    job: J,
    chosen: AiProviderId | null,
  ): Promise<{ id: AiProviderId; reader: NonNullable<AiProvider[J]>; key: string } | undefined> {
    const providers = this.#deps.providers.toSorted(
      (a, b) => Number(b.info.id === chosen) - Number(a.info.id === chosen),
    );
    for (const provider of providers) {
      const reader = provider[job];
      if (!reader) continue;
      const key = await this.#deps.keys.read(provider.info.id);
      if (key !== undefined) return { id: provider.info.id, reader, key };
    }
    return undefined;
  }

  /** Your tasting words into tags, by the chosen provider, else the first that can. */
  readTaste(words: string): Promise<Result<TasteTag[], AiReadError>> {
    return this.#once('taste', async () => {
      const { enabled, tasteProvider } = await this.#deps.settings();
      if (!enabled) return err({ kind: 'off' });
      const picked = await this.#pick('taste', tasteProvider);
      if (!picked) return err({ kind: 'no-key' });
      const read = await this.#timed('taste', picked.id, words.length, () =>
        picked.reader.readTaste(words, picked.key),
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
      const picked = await this.#pick('specSheet', null);
      if (!picked) return err({ kind: 'no-key' });
      let sheet: SpecSheetSource;
      if (request.kind === 'text') {
        sheet = request;
      } else {
        const pdf = await this.#readPdf(parent, picked.id);
        if (!pdf.ok) return pdf;
        if (pdf.value === undefined) return ok({ status: 'cancelled' });
        sheet = { kind: 'pdf', bytes: pdf.value };
      }
      const size = sheet.kind === 'text' ? sheet.text.length : sheet.bytes.length;
      const read = await this.#timed('spec-sheet', picked.id, size, () =>
        picked.reader.readSpecSheet(sheet, picked.key),
      );
      const answered = await this.#stillOn(read);
      if (!answered.ok) return answered;
      const fields = specSheetFields(answered.value);
      if (isEmptySheet(fields)) this.#deps.logger.info('ai.sheet-empty', { kind: sheet.kind });
      return ok({ status: 'read', fields });
    });
  }

  /** The PDF's bytes; undefined when you cancelled; refused over the limits or not a PDF. */
  async #readPdf(
    parent: DialogParent,
    provider: AiProviderId,
  ): Promise<Result<Uint8Array | undefined, AiReadError>> {
    const { files, logger } = this.#deps;
    const path = await files.choosePdf(parent);
    if (path === undefined) return ok(undefined);
    let bytes: Uint8Array;
    try {
      if ((await files.sizeOf(path)) > SPEC_SHEET_PDF_MAX_BYTES)
        return err({ kind: 'too-long', limit: '10 MB' });
      // One byte past the limit tells a file that grew since it was measured.
      bytes = await files.readBytes(path, SPEC_SHEET_PDF_MAX_BYTES + 1);
      if (bytes.length > SPEC_SHEET_PDF_MAX_BYTES) return err({ kind: 'too-long', limit: '10 MB' });
    } catch (error) {
      logger.warn('ai.sheet-read-failed', { error: serializeError(error) });
      return err({ kind: 'failed', provider });
    }
    if (!isPdf(bytes)) {
      logger.info('ai.sheet-not-pdf', { bytes: bytes.length });
      return err({ kind: 'unreadable', provider });
    }
    if (pdfPageCount(bytes) > SPEC_SHEET_PDF_MAX_PAGES)
      return err({ kind: 'too-long', limit: `${String(SPEC_SHEET_PDF_MAX_PAGES)} pages` });
    return ok(bytes);
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
