import { z } from 'zod';
import { DriverErrorSchema } from './driver-error';

/** One output the coach would change: what is set now and what it suggests, in %. */
export const CoachChangeSchema = z.object({ from: z.number(), to: z.number() });

/** Heater and fan as the coach card names them; Apply sets only these. */
export const CoachOutputSchema = z.enum(['heater', 'fan']);

/**
 * What the coach card says (docs/spec/manual-mode.md, Coach). `id` names one piece of advice, so
 * Apply and Dismiss act on the card you saw, never on one that replaced it.
 */
export const CoachAdviceSchema = z.discriminatedUnion('kind', [
  /** Auto would set these now; at least one output is there. */
  z.object({
    kind: z.literal('setting'),
    id: z.number().int(),
    heater: CoachChangeSchema.optional(),
    fan: CoachChangeSchema.optional(),
    /** Why, in one line: "4 °C below target, RoR falling". */
    reason: z.string(),
  }),
  /** "First crack in ~45 s · listen". */
  z.object({ kind: z.literal('first-crack-soon'), id: z.number().int(), inS: z.number() }),
  /** "Drop in ~30 s · 1:45 development". */
  z.object({
    kind: z.literal('drop-soon'),
    id: z.number().int(),
    inS: z.number(),
    devTimeS: z.number(),
  }),
  /** "BT cap 225 °C in ~30 s". */
  z.object({
    kind: z.literal('cap-soon'),
    id: z.number().int(),
    inS: z.number(),
    capC: z.number(),
  }),
]);

/** The coach card for the window: nothing to say is `advice: null`. */
export const CoachStatusSchema = z.object({
  advice: CoachAdviceSchema.nullable(),
  /** The profile's name when it needs calibration, so you weigh its advice. */
  needsCalibration: z.string().nullable(),
});

/** No card: what a window shows before main has said anything. */
export const COACH_QUIET: z.infer<typeof CoachStatusSchema> = {
  advice: null,
  needsCalibration: null,
};

/** Apply or Dismiss the card with this id. */
export const CoachRequestSchema = z.object({ id: z.number().int() });

/**
 * Apply refused: the card changed or went (`stale`), the roast no longer allows it (`not-now`), or
 * the roaster refused the output.
 */
export const CoachApplyErrorSchema = z.union([
  z.object({ kind: z.literal('stale') }),
  z.object({ kind: z.literal('not-now') }),
  DriverErrorSchema,
]);

export type CoachChange = z.infer<typeof CoachChangeSchema>;
export type CoachOutput = z.infer<typeof CoachOutputSchema>;
export type CoachAdvice = z.infer<typeof CoachAdviceSchema>;
export type CoachSetting = Extract<CoachAdvice, { kind: 'setting' }>;
export type CoachStatus = z.infer<typeof CoachStatusSchema>;
export type CoachRequest = z.infer<typeof CoachRequestSchema>;
export type CoachApplyError = z.infer<typeof CoachApplyErrorSchema>;

/**
 * The `coach-applied` event's detail (docs/spec/data-model.md): each output changed with from and
 * to, "heater 65→75, fan 50→40".
 */
export function coachAppliedDetail(setting: Pick<CoachSetting, 'heater' | 'fan'>): string {
  return CoachOutputSchema.options
    .flatMap((output) => {
      const change = setting[output];
      return change ? [`${output} ${String(change.from)}→${String(change.to)}`] : [];
    })
    .join(', ');
}
