import type { AiProvider, AiReadError, RawSpecSheet, Result, TasteTag } from '@roastpilot/shared';

/**
 * Reads your tasting words into taste tags (docs/spec/ai-helpers.md, Reading). One per provider
 * that can; the setting picks which one a read uses.
 */
export interface TasteReader {
  readonly provider: AiProvider;
  readTaste(words: string, key: string): Promise<Result<TasteTag[], AiReadError>>;
}

/** A spec sheet as sent: pasted text, or a PDF's bytes main read after you picked it. */
export type SpecSheetSource = { kind: 'text'; text: string } | { kind: 'pdf'; bytes: Uint8Array };

/** Reads a supplier's spec sheet into raw bean values, checked afterwards (`specSheetFields`). */
export interface SpecSheetReader {
  readonly provider: AiProvider;
  readSpecSheet(sheet: SpecSheetSource, key: string): Promise<Result<RawSpecSheet, AiReadError>>;
}
