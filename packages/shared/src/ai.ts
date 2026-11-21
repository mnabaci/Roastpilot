import { z } from 'zod';
import { BeanFieldsSchema, BeanSpeciesSchema } from './bean';
import { TasteWordsSchema } from './taste';

/** Who reads text for the AI helpers (docs/spec/ai-helpers.md, Providers). */
export const AiProviderSchema = z.enum(['claude', 'jev']);
export const AI_PROVIDERS = AiProviderSchema.options;

export const AI_PROVIDER_LABELS: Readonly<Record<AiProvider, string>> = {
  claude: 'Claude',
  jev: 'Jev',
};

/** Only Claude reads spec sheets: Jev answers yes/no and pick-one questions. */
export const SPEC_SHEET_PROVIDER: AiProvider = 'claude';

/** The AI helpers' settings; the keys live apart, encrypted (ai-helpers.md, Turning it on). */
export const AiSettingsSchema = z.object({
  enabled: z.boolean().catch(false).default(false),
  /** Who reads tasting words; the one with a key is used when this one has none. */
  tasteProvider: AiProviderSchema.catch('claude').default('claude'),
});

export const DEFAULT_AI_SETTINGS: AiSettings = { enabled: false, tasteProvider: 'claude' };

/** Whether each provider's key is saved, and its last four characters: never the key itself. */
export const AiKeyStatusSchema = z.object({
  saved: z.boolean(),
  last4: z.string().max(4).nullable(),
});
export const AiKeysSchema = z.record(AiProviderSchema, AiKeyStatusSchema);

export const AI_KEY_MAX = 400;
export const SaveAiKeyRequestSchema = z.object({
  provider: AiProviderSchema,
  key: z.string().trim().min(8, 'That key is too short').max(AI_KEY_MAX),
});

export const AiKeyErrorSchema = z.discriminatedUnion('kind', [
  /** The computer's keychain can't encrypt it. */
  z.object({ kind: z.literal('unsafe-storage') }),
  z.object({ kind: z.literal('storage-failed'), message: z.string() }),
]);

/** Limits on what is sent (ai-helpers.md, Reading). */
export const SPEC_SHEET_TEXT_MAX = 20_000;
export const SPEC_SHEET_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const SPEC_SHEET_PDF_MAX_PAGES = 20;

export const ReadTasteRequestSchema = z.object({ words: TasteWordsSchema.min(1) });

/** Pasted text, or a PDF main asks you to pick (the renderer never names a file). */
export const ReadSpecSheetRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string().trim().min(1).max(SPEC_SHEET_TEXT_MAX) }),
  z.object({ kind: z.literal('pdf') }),
]);

/** What a spec sheet filled: only fields it had, each as the bean form would take it. */
export const SpecSheetFieldsSchema = BeanFieldsSchema.pick({
  name: true,
  origin: true,
  process: true,
  variety: true,
  altitudeM: true,
  densityGL: true,
  moisturePct: true,
  screen: true,
  decaf: true,
  supplier: true,
  notes: true,
})
  // The form's species defaults to none; a sheet that doesn't say leaves it out instead.
  .extend({ species: BeanSpeciesSchema })
  .partial();

/**
 * What a provider reads off a sheet, before the bean form's checks: every field may be missing,
 * altitude may be a range, tasting notes a list (core's `specSheetFields` turns it into fields).
 */
export const RawSpecSheetSchema = z.object({
  name: z.string().nullable(),
  origin: z.string().nullable(),
  process: BeanFieldsSchema.shape.process.nullable(),
  species: BeanSpeciesSchema.nullable(),
  variety: z.string().nullable(),
  altitudeMinM: z.number().nullable(),
  altitudeMaxM: z.number().nullable(),
  densityGL: z.number().nullable(),
  moisturePct: z.number().nullable(),
  screen: z.number().nullable(),
  decaf: z.boolean().nullable(),
  supplier: z.string().nullable(),
  tastingNotes: z.array(z.string()),
});

export type ReadSpecSheetResult =
  { status: 'cancelled' } | { status: 'read'; fields: SpecSheetFields };

/** Why a read failed, the same for every provider (ai-helpers.md, When it fails). */
export const AiReadErrorSchema = z.discriminatedUnion('kind', [
  /** The AI helpers switch is off. */
  z.object({ kind: z.literal('off') }),
  z.object({ kind: z.literal('no-key'), provider: AiProviderSchema }),
  z.object({ kind: z.literal('key-refused'), provider: AiProviderSchema }),
  z.object({ kind: z.literal('rate-limited'), provider: AiProviderSchema }),
  z.object({ kind: z.literal('offline'), provider: AiProviderSchema }),
  z.object({ kind: z.literal('unreadable'), provider: AiProviderSchema }),
  z.object({ kind: z.literal('failed'), provider: AiProviderSchema }),
  /** Over a limit: nothing was sent. */
  z.object({ kind: z.literal('too-long'), limit: z.string() }),
  /** Another read of the same kind is running. */
  z.object({ kind: z.literal('busy') }),
]);

export type AiProvider = z.infer<typeof AiProviderSchema>;
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export type AiKeyStatus = z.infer<typeof AiKeyStatusSchema>;
export type AiKeys = z.infer<typeof AiKeysSchema>;
export type SaveAiKeyRequest = z.infer<typeof SaveAiKeyRequestSchema>;
export type AiKeyError = z.infer<typeof AiKeyErrorSchema>;
export type ReadTasteRequest = z.infer<typeof ReadTasteRequestSchema>;
export type ReadSpecSheetRequest = z.infer<typeof ReadSpecSheetRequestSchema>;
export type SpecSheetFields = z.infer<typeof SpecSheetFieldsSchema>;
export type RawSpecSheet = z.infer<typeof RawSpecSheetSchema>;
export type AiReadError = z.infer<typeof AiReadErrorSchema>;
