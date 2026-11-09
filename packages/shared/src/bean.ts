import { z } from 'zod';
import { ProfileIdSchema } from './profile';

export const BeanProcessSchema = z.enum(['washed', 'natural', 'honey', 'other']);

/** The coffee plant species: nearly every specialty bean is Arabica. */
export const BeanSpeciesSchema = z.enum(['arabica', 'robusta', 'liberica', 'excelsa', 'other']);

export const BeanIdSchema = z.number().int().positive();

const positive = (message = 'Must be above 0') => z.number().positive(message);

/** A web address the app may open in the browser: http or https only. */
const WebLinkSchema = z
  .string()
  .trim()
  .max(2000)
  .pipe(z.url({ protocol: /^https?$/, error: 'Enter a web address, starting with https://' }));

/** Whether `text` is a link the app may open (WebLinkSchema). */
export const isWebLink = (text: string): boolean => WebLinkSchema.safeParse(text).success;

/** What you enter about a bean (docs/spec/beans-favourites-ghost.md). */
export const BeanFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(120),
  origin: z.string().trim().min(1, 'Enter an origin').max(120),
  process: BeanProcessSchema,
  /** Missing from files and beans saved before it: none. */
  species: BeanSpeciesSchema.nullable().default(null),
  variety: z.string().trim().max(120).nullable(),
  altitudeM: positive().nullable(),
  densityGL: positive().nullable(),
  moisturePct: z.number().min(0, 'At least 0').max(100, 'At most 100').nullable(),
  screen: positive().nullable(),
  decaf: z.boolean(),
  supplier: z.string().trim().max(120).nullable(),
  /** Where to order it again. Missing from files and beans saved before it: none. */
  link: WebLinkSchema.nullable().default(null),
  lowStockG: z.number().min(0, 'At least 0'),
  notes: z.string().max(4000).nullable(),
});

export const BeanSchema = BeanFieldsSchema.extend({
  id: BeanIdSchema,
  /** The bean's own profile: its first suggestion. */
  profileId: ProfileIdSchema.nullable(),
  greenG: z.number().nonnegative(),
  roastedG: z.number().nonnegative(),
  archived: z.boolean(),
  /** From its roasts with a roasted weight; null until it has one. */
  avgLossPct: z.number().nullable(),
});

export const AddStockSchema = z.object({
  beanId: BeanIdSchema,
  grams: positive(),
  purchasedAt: z.string().min(1),
});

/**
 * Why stock was changed by hand: a count of the bags, a batch given back at Clear, or beans taken
 * out for any other reason (given away, spilled, a sample).
 */
export const StockAdjustReasonSchema = z.enum(['count', 'returned', 'taken']);

/** The stock as it now is; what changed is kept as an adjustment in its history. */
export const AdjustStockSchema = z.object({
  beanId: BeanIdSchema,
  greenG: z.number().nonnegative(),
  roastedG: z.number().nonnegative(),
  reason: StockAdjustReasonSchema.default('count'),
  /** In your words, for `taken`: "Gave 200 g to Sam". */
  note: z.string().trim().max(120).nullable().default(null),
});

/**
 * One thing that moved a bean's stock (docs/spec/batch-and-stock.md, Stock history), with what it
 * changed in grams: a purchase, a roast made here, or an adjustment.
 */
export const StockMovementSchema = z.object({
  /** A purchase's date, or the moment of a roast or adjustment (ISO). */
  at: z.string(),
  kind: z.enum(['bought', 'roasted', 'counted', 'returned', 'taken']),
  greenG: z.number(),
  roastedG: z.number(),
  /** The roast, for `roasted`. */
  roastId: z.number().int().positive().nullable(),
  /** Why, for `taken`, when you said. */
  note: z.string().nullable(),
});

export const UpdateBeanSchema = z.object({
  id: BeanIdSchema,
  fields: BeanFieldsSchema,
  profileId: ProfileIdSchema.nullable(),
});

export const SetArchivedSchema = z.object({ id: BeanIdSchema, archived: z.boolean() });

/** Why a bean's order link didn't open. */
export const OpenBeanLinkErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('bean-not-found'), id: BeanIdSchema }),
  z.object({ kind: z.literal('no-link'), id: BeanIdSchema }),
  z.object({ kind: z.literal('storage-failed'), message: z.string() }),
  z.object({ kind: z.literal('open-failed') }),
]);
export type OpenBeanLinkError = z.infer<typeof OpenBeanLinkErrorSchema>;

/** What the next roast is of, set before Preheat and read at charge. Every part is optional. */
export const RoastSetupSchema = z.object({
  beanId: BeanIdSchema.nullable(),
  batchG: positive().nullable(),
  ghostRoastId: z.number().int().positive().nullable(),
});

export const NO_ROAST_SETUP: z.infer<typeof RoastSetupSchema> = {
  beanId: null,
  batchG: null,
  ghostRoastId: null,
};

export type BeanProcess = z.infer<typeof BeanProcessSchema>;
export type BeanSpecies = z.infer<typeof BeanSpeciesSchema>;
export type BeanId = z.infer<typeof BeanIdSchema>;
export type BeanFields = z.infer<typeof BeanFieldsSchema>;
export type Bean = z.infer<typeof BeanSchema>;
export type AddStock = z.infer<typeof AddStockSchema>;
export type AdjustStock = z.input<typeof AdjustStockSchema>;
export type StockAdjustReason = z.infer<typeof StockAdjustReasonSchema>;
export type StockMovement = z.infer<typeof StockMovementSchema>;
export type UpdateBean = z.infer<typeof UpdateBeanSchema>;
export type RoastSetup = z.infer<typeof RoastSetupSchema>;
