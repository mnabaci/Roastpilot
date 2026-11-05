import { z } from 'zod';
import { ConnectTargetSchema } from './connection';
import { AutoTuningSchema, ProfileIdSchema } from './profile';

/** Which driver and built-in profiles a roaster uses (docs/spec/roasters.md). */
export const RoasterModelSchema = z.enum(['skywalker', 'simulator']);

/** A record's limits can only be set at or below its model's. */
export const MODEL_LIMITS: Readonly<
  Record<z.infer<typeof RoasterModelSchema>, { maxTempC: number; maxTimeS: number }>
> = {
  skywalker: { maxTempC: 240, maxTimeS: 20 * 60 },
  simulator: { maxTempC: 240, maxTimeS: 20 * 60 },
};

export const RoasterIdSchema = z.number().int().positive();

const MAX_OFFSET_C = 20;

export const RoasterSchema = z
  .object({
    id: RoasterIdSchema,
    name: z.string().trim().min(1, 'Enter a name').max(64),
    model: RoasterModelSchema,
    connection: ConnectTargetSchema.nullable(),
    batchMinG: z.number().positive('Must be above 0'),
    batchIdealG: z.number().positive('Must be above 0'),
    batchMaxG: z.number().positive('Must be above 0'),
    maxTempC: z.number().positive('Must be above 0'),
    maxTimeS: z.number().positive('Must be above 0'),
    tempOffsetC: z
      .number()
      .min(-MAX_OFFSET_C, `At least -${String(MAX_OFFSET_C)} °C`)
      .max(MAX_OFFSET_C, `At most ${String(MAX_OFFSET_C)} °C`),
    tuning: AutoTuningSchema,
    active: z.boolean(),
  })
  .superRefine((roaster, ctx) => {
    const issue = (field: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: [field], message });
    };
    const limits = MODEL_LIMITS[roaster.model];
    if (roaster.maxTempC > limits.maxTempC) {
      issue('maxTempC', `At most ${String(limits.maxTempC)} °C on this model`);
    }
    if (roaster.maxTimeS > limits.maxTimeS) {
      issue('maxTimeS', `At most ${String(limits.maxTimeS / 60)} min on this model`);
    }
    if (roaster.batchMinG > roaster.batchIdealG) issue('batchMinG', 'Must not be above ideal');
    if (roaster.batchIdealG > roaster.batchMaxG) issue('batchMaxG', 'Must not be below ideal');
  });

export const NewRoasterSchema = z.object({
  name: z.string().trim().min(1).max(64),
  model: RoasterModelSchema,
});

export const CopyProfileRequestSchema = z.object({
  id: ProfileIdSchema,
  roasterId: RoasterIdSchema,
});

export const RoasterErrorSchema = z.discriminatedUnion('kind', [
  /** Connected: the roaster and its limits wait until you disconnect. */
  z.object({ kind: z.literal('in-use') }),
  z.object({ kind: z.literal('active') }),
  z.object({ kind: z.literal('has-roasts'), roasts: z.number(), profiles: z.number() }),
  z.object({ kind: z.literal('not-found'), id: RoasterIdSchema }),
  z.object({ kind: z.literal('storage-failed'), message: z.string() }),
]);

export type RoasterModel = z.infer<typeof RoasterModelSchema>;
export type RoasterId = z.infer<typeof RoasterIdSchema>;
export type Roaster = z.infer<typeof RoasterSchema>;
export type NewRoaster = z.infer<typeof NewRoasterSchema>;
export type RoasterError = z.infer<typeof RoasterErrorSchema>;
