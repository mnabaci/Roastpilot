import { z } from 'zod';
import { ConnectTargetSchema, type ConnectTarget } from './connection';
import { AutoTuningSchema, ProfileIdSchema } from './profile';
import { MIN_FAN_HEATING, Tc4WiringSchema } from './tc4-wiring';
import { diffInText, tempInText } from './units';

/** What the app knows about a roaster model without its driver (ADR 0024). */
export interface RoasterModelFacts {
  /** How the model is named on screen. */
  readonly label: string;
  /** A record's limits can only be set at or below these. */
  readonly limits: { readonly maxTempC: number; readonly maxTimeS: number };
  /** Its drum has a speed rather than only on/off, so the Roasters page offers Drum speed. */
  readonly drumSpeed: boolean;
  /** The kind of connection its driver uses. */
  readonly connection: ConnectTarget['kind'];
  /** Its record holds TC4 wiring (probes, outputs, baud), as a home-built roaster's does. */
  readonly wiring: boolean;
  /** It has a bean cooler (a tray fan), so the record offers "Bean cooler helps cool the drum". */
  readonly beanCooler: boolean;
  /** What its board runs, for connect errors ("is SkyCommand flashed…"); none for the Simulator. */
  readonly firmware: string | null;
}

/**
 * Every roaster model, by id: the one hand-edited list of models (ADR 0024). zod, the database
 * and the screens read it; everything else about a model is its definition in `drivers`, which a
 * test holds to these facts.
 */
export const ROASTER_MODEL_FACTS = {
  skywalker: {
    label: 'Skywalker',
    limits: { maxTempC: 240, maxTimeS: 20 * 60 },
    drumSpeed: false,
    connection: 'serial',
    wiring: false,
    beanCooler: true,
    firmware: 'SkyCommand',
  },
  tc4: {
    label: 'Generic TC4',
    limits: { maxTempC: 250, maxTimeS: 20 * 60 },
    drumSpeed: false,
    connection: 'serial',
    wiring: true,
    beanCooler: false,
    firmware: 'aArtisanQ_PID',
  },
  simulator: {
    label: 'Simulator',
    limits: { maxTempC: 240, maxTimeS: 20 * 60 },
    drumSpeed: true,
    connection: 'simulator',
    wiring: false,
    beanCooler: true,
    firmware: null,
  },
} as const satisfies Readonly<Record<string, RoasterModelFacts>>;

type ModelId = keyof typeof ROASTER_MODEL_FACTS;

/** The model ids, the facts' keys, for zod and the database column. */
export const ROASTER_MODEL_IDS = Object.keys(ROASTER_MODEL_FACTS) as [ModelId, ...ModelId[]];

/** Which driver and built-in profiles a roaster uses (docs/spec/roasters.md). */
export const RoasterModelSchema = z.enum(ROASTER_MODEL_IDS);

/** A known model's facts. */
export const modelFacts = (model: ModelId): RoasterModelFacts => ROASTER_MODEL_FACTS[model];

export const RoasterIdSchema = z.number().int().positive();

const MAX_OFFSET_C = 20;

/** A drum with a speed turns at its roaster's usual speed when on (docs/spec/roasters.md). */
export const DRUM_SPEED = { minPct: 5, maxPct: 100, stepPct: 5, defaultPct: 60 } as const;

/** A record's fields before its rules: a Roastpilot file leaves some out (roaster-file). */
export const RoasterObjectSchema = z.object({
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
    .min(-MAX_OFFSET_C, `At least ${diffInText(-MAX_OFFSET_C)}`)
    .max(MAX_OFFSET_C, `At most ${diffInText(MAX_OFFSET_C)}`),
  tuning: AutoTuningSchema,
  /** The tray fan sits under the drum, so it stays on while the drum cools (roasters.md). */
  coolerHelpsDrum: z.boolean(),
  /** The usual speed of a drum that has one; an on/off drum ignores it. */
  drumSpeedPct: z
    .number()
    .min(DRUM_SPEED.minPct, `At least ${String(DRUM_SPEED.minPct)} %`)
    .max(DRUM_SPEED.maxPct, `At most ${String(DRUM_SPEED.maxPct)} %`)
    .multipleOf(DRUM_SPEED.stepPct, `In steps of ${String(DRUM_SPEED.stepPct)} %`),
  /** How a home-built TC4 roaster is wired; none for a model that has no wiring. */
  wiring: Tc4WiringSchema.nullable().default(null),
  /** For air roasters: while the heater is on, the fan never goes below this; 0 is off. */
  minFanHeatingPct: z
    .number()
    .min(MIN_FAN_HEATING.minPct, `At least ${String(MIN_FAN_HEATING.minPct)} %`)
    .max(MIN_FAN_HEATING.maxPct, `At most ${String(MIN_FAN_HEATING.maxPct)} %`)
    .multipleOf(MIN_FAN_HEATING.stepPct, `In steps of ${String(MIN_FAN_HEATING.stepPct)} %`)
    .default(0),
  active: z.boolean(),
});

type RoasterRuleShape = Pick<
  z.infer<typeof RoasterObjectSchema>,
  | 'model'
  | 'maxTempC'
  | 'maxTimeS'
  | 'batchMinG'
  | 'batchIdealG'
  | 'batchMaxG'
  | 'wiring'
  | 'minFanHeatingPct'
>;

/** Limits at or below the model's own, and batch sizes in order (docs/spec/roasters.md). */
export function checkRoaster(roaster: RoasterRuleShape, ctx: z.RefinementCtx): void {
  const issue = (field: string, message: string) => {
    ctx.addIssue({ code: 'custom', path: [field], message });
  };
  const { limits } = modelFacts(roaster.model);
  if (roaster.maxTempC > limits.maxTempC) {
    issue('maxTempC', `At most ${tempInText(limits.maxTempC)} on this model`);
  }
  if (roaster.maxTimeS > limits.maxTimeS) {
    issue('maxTimeS', `At most ${String(limits.maxTimeS / 60)} min on this model`);
  }
  if (roaster.batchMinG > roaster.batchIdealG) issue('batchMinG', 'Must not be above ideal');
  if (roaster.batchIdealG > roaster.batchMaxG) issue('batchMaxG', 'Must not be below ideal');
  const { wiring } = modelFacts(roaster.model);
  if (wiring && roaster.wiring === null) issue('wiring', 'Choose the wiring');
  // Only a roaster with wiring has the setting, and only its handshake leaves the outputs off.
  if (!wiring && roaster.minFanHeatingPct > 0) issue('minFanHeatingPct', 'Not on this model');
}

export const RoasterSchema = RoasterObjectSchema.superRefine(checkRoaster);

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
