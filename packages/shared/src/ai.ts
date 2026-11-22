import { z } from 'zod';
import { BeanFieldsSchema, BeanSpeciesSchema } from './bean';
import { SupplierFieldsSchema } from './supplier';
import { TasteWordsSchema } from './taste';

/**
 * An AI provider's id. Providers are registered in main, each describing itself (docs/spec/
 * ai-helpers.md, Providers): nothing outside its own module names one.
 */
export const AiProviderIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);

/** A model's name on screen: "Haiku 5.5". */
export const AiModelNameSchema = z.string().min(1).max(40);

/** What a provider says about itself, for Settings and the screens' lines. */
export const AiProviderInfoSchema = z.object({
  id: AiProviderIdSchema,
  /** Its name on screen: "Claude". */
  label: z.string().min(1).max(40),
  /** Who what it reads is sent to: "Anthropic". */
  company: z.string().min(1).max(60),
  /** Where you get a key, as a host: "console.anthropic.com". */
  keyFrom: z.string().min(1).max(120),
  /**
   * The model that reads each job, by its name on screen ("Haiku 5.5"); null for a job it doesn't
   * do. The first it tries: a retired one is passed over for the next (ai-helpers.md, Models).
   */
  models: z.object({
    taste: AiModelNameSchema.nullable(),
    specSheet: AiModelNameSchema.nullable(),
  }),
});

/** Whether a provider's key is saved, and its last four characters: never the key itself. */
export const AiKeyStatusSchema = z.object({
  saved: z.boolean(),
  last4: z.string().max(4).nullable(),
});

/** A registered provider with its key's status: one row in Settings › AI helpers. */
export const AiProviderEntrySchema = AiProviderInfoSchema.extend({ key: AiKeyStatusSchema });

/** The AI helpers' settings; the keys live apart, encrypted (ai-helpers.md, Turning it on). */
export const AiSettingsSchema = z.object({
  enabled: z.boolean().catch(false).default(false),
  /** Who reads tasting words; none chosen, or one without a key, is the first that can. */
  tasteProvider: AiProviderIdSchema.nullable().catch(null).default(null),
});

export const DEFAULT_AI_SETTINGS: AiSettings = { enabled: false, tasteProvider: null };

export const AI_KEY_MAX = 400;
export const SaveAiKeyRequestSchema = z.object({
  provider: AiProviderIdSchema,
  key: z
    .string()
    .trim()
    .min(8, 'That key is too short')
    .max(AI_KEY_MAX)
    // Printable characters only: a line break or a space pasted inside would make a header
    // the network refuses, with the key in its message.
    .regex(/^[\x21-\x7E]+$/, 'A key has no spaces or line breaks'),
});

export const AiKeyErrorSchema = z.discriminatedUnion('kind', [
  /** The computer's keychain can't encrypt it. */
  z.object({ kind: z.literal('unsafe-storage') }),
  z.object({ kind: z.literal('storage-failed'), message: z.string() }),
  /** No provider with that id is registered. */
  z.object({ kind: z.literal('unknown-provider') }),
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
  .extend({
    species: BeanSpeciesSchema,
    // How to reach the supplier, for adding it when it is new (Suppliers).
    supplierWebsite: SupplierFieldsSchema.shape.website.unwrap(),
    supplierEmail: SupplierFieldsSchema.shape.email.unwrap(),
    supplierPhone: SupplierFieldsSchema.shape.phone.unwrap(),
  })
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
  supplierWebsite: z.string().nullable(),
  supplierEmail: z.string().nullable(),
  supplierPhone: z.string().nullable(),
  tastingNotes: z.array(z.string()),
});

export type ReadSpecSheetResult =
  { status: 'cancelled' } | { status: 'read'; fields: SpecSheetFields };

/** Why a read failed, the same for every provider (ai-helpers.md, When it fails). */
export const AiReadErrorSchema = z.discriminatedUnion('kind', [
  /** The AI helpers switch is off. */
  z.object({ kind: z.literal('off') }),
  /** No provider that can read this has a key. */
  z.object({ kind: z.literal('no-key') }),
  z.object({ kind: z.literal('key-refused'), provider: AiProviderIdSchema }),
  z.object({ kind: z.literal('rate-limited'), provider: AiProviderIdSchema }),
  z.object({ kind: z.literal('offline'), provider: AiProviderIdSchema }),
  z.object({ kind: z.literal('unreadable'), provider: AiProviderIdSchema }),
  z.object({ kind: z.literal('failed'), provider: AiProviderIdSchema }),
  /** Every model the provider would read this with is retired: a newer Roastpilot reads it. */
  z.object({ kind: z.literal('model-retired'), provider: AiProviderIdSchema }),
  /** Over a limit: nothing was sent. */
  z.object({ kind: z.literal('too-long'), limit: z.string() }),
  /** Another read of the same kind is running. */
  z.object({ kind: z.literal('busy') }),
]);

export type AiProviderId = z.infer<typeof AiProviderIdSchema>;
export type AiProviderInfo = z.infer<typeof AiProviderInfoSchema>;
export type AiProviderEntry = z.infer<typeof AiProviderEntrySchema>;
export type AiKeyStatus = z.infer<typeof AiKeyStatusSchema>;
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export type SaveAiKeyRequest = z.infer<typeof SaveAiKeyRequestSchema>;
export type AiKeyError = z.infer<typeof AiKeyErrorSchema>;
export type ReadTasteRequest = z.infer<typeof ReadTasteRequestSchema>;
export type ReadSpecSheetRequest = z.infer<typeof ReadSpecSheetRequestSchema>;
export type SpecSheetFields = z.infer<typeof SpecSheetFieldsSchema>;
export type RawSpecSheet = z.infer<typeof RawSpecSheetSchema>;
export type AiReadError = z.infer<typeof AiReadErrorSchema>;
