import { serializeError, type Logger } from '@roastpilot/core';
import {
  err,
  ok,
  SPEC_SHEET_PDF_MAX_BYTES,
  SPEC_SHEET_PDF_MAX_PAGES,
  type AiProviderId,
  type AiReadError,
  type Result,
} from '@roastpilot/shared';
import type { DialogParent } from '../files/file-dialogs';

/** Reading the PDF you picked, the file system injected. */
export interface SheetFiles {
  /** The PDF you pick in a dialog on `parent`; undefined when you cancel. */
  choosePdf: (parent: DialogParent) => Promise<string | undefined>;
  sizeOf: (path: string) => Promise<number>;
  /** At most `limit` bytes, so a file that grew after `sizeOf` is never read whole. */
  readBytes: (path: string, limit: number) => Promise<Uint8Array>;
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
 * The PDF you pick, as bytes; undefined when you cancel; refused over the limits (docs/spec/
 * ai-helpers.md, Reading) or when it isn't a PDF. Nothing is sent from here.
 */
export async function readSheetPdf(
  files: SheetFiles,
  logger: Logger,
  parent: DialogParent,
  provider: AiProviderId,
): Promise<Result<Uint8Array | undefined, AiReadError>> {
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
