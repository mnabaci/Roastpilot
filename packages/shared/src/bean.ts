import { z } from 'zod';
import { ProfileIdSchema } from './profile';

export const BeanProcessSchema = z.enum(['washed', 'natural', 'honey', 'other']);

export const BeanIdSchema = z.number().int().positive();

const positive = (message = 'Must be above 0') => z.number().positive(message);

/** What you enter about a bean (docs/spec/beans-favourites-ghost.md). */
export const BeanFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(120),
  origin: z.string().trim().min(1, 'Enter an origin').max(120),
  process: BeanProcessSchema,
  variety: z.string().trim().max(120).nullable(),
  altitudeM: positive().nullable(),
  densityGL: positive().nullable(),
  moisturePct: z.number().min(0, 'At least 0').max(100, 'At most 100').nullable(),
  screen: positive().nullable(),
  decaf: z.boolean(),
  supplier: z.string().trim().max(120).nullable(),
  lowStockG: z.number().min(0, 'At least 0'),
  notes: z.string().max(4000).nullable(),
});

/** How an order is split into batches (docs/spec/batch-and-stock.md). */
export const BatchPlanSchema = z.object({
  kind: z.enum(['equal', 'ideal']),
  batchesG: z.array(positive()).min(1),
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
  /** The plan picked with the latest stock. */
  batchPlan: BatchPlanSchema.nullable(),
});

export const AddStockSchema = z.object({
  beanId: BeanIdSchema,
  grams: positive(),
  purchasedAt: z.string().min(1),
  plan: BatchPlanSchema.nullable(),
});

export const AdjustStockSchema = z.object({
  beanId: BeanIdSchema,
  greenG: z.number().nonnegative(),
  roastedG: z.number().nonnegative(),
});

export const UpdateBeanSchema = z.object({
  id: BeanIdSchema,
  fields: BeanFieldsSchema,
  profileId: ProfileIdSchema.nullable(),
});

export const SetArchivedSchema = z.object({ id: BeanIdSchema, archived: z.boolean() });

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
export type BeanId = z.infer<typeof BeanIdSchema>;
export type BeanFields = z.infer<typeof BeanFieldsSchema>;
export type Bean = z.infer<typeof BeanSchema>;
export type BatchPlan = z.infer<typeof BatchPlanSchema>;
export type AddStock = z.infer<typeof AddStockSchema>;
export type AdjustStock = z.infer<typeof AdjustStockSchema>;
export type UpdateBean = z.infer<typeof UpdateBeanSchema>;
export type RoastSetup = z.infer<typeof RoastSetupSchema>;
