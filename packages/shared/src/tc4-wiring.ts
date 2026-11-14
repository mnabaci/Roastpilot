import { z } from 'zod';

/** The baud rates a generic TC4 roaster may use; the stock firmware's is 115200. */
export const TC4_BAUDS = [9600, 19200, 38400, 57600, 115200] as const;

/** The board's thermocouple inputs, TC1–TC4. */
export const TC4_INPUTS = [1, 2, 3, 4] as const;

/** Where the heater and the fan may be wired on the board (docs/spec/roasters.md, Generic TC4). */
export const TC4_HEATER_OUTPUTS = ['OT1', 'IO3'] as const;
export const TC4_FAN_OUTPUTS = ['OT2', 'IO3'] as const;

/** How a home-built TC4 roaster is wired: on its record, as every build differs. */
export const Tc4WiringSchema = z
  .object({
    /** The bean probe's input, 1–4. */
    btInput: z.number().int().min(1).max(4),
    /** The environment probe's input, 1–4, or 0 for none. */
    etInput: z.number().int().min(0).max(4),
    heaterOutput: z.enum(TC4_HEATER_OUTPUTS),
    fanOutput: z.enum(TC4_FAN_OUTPUTS),
    baud: z.union(TC4_BAUDS.map((baud) => z.literal(baud))),
  })
  .superRefine((wiring, ctx) => {
    if (wiring.etInput === wiring.btInput) {
      ctx.addIssue({ code: 'custom', path: ['etInput'], message: 'Already the bean probe' });
    }
    if (wiring.fanOutput === wiring.heaterOutput) {
      ctx.addIssue({ code: 'custom', path: ['fanOutput'], message: "Already the heater's output" });
    }
  });

export type Tc4Wiring = z.infer<typeof Tc4WiringSchema>;

/** The stock firmware's and Artisan's defaults: ET on TC1, BT on TC2, heater OT1, AC fan OT2. */
export const DEFAULT_TC4_WIRING: Tc4Wiring = {
  btInput: 2,
  etInput: 1,
  heaterOutput: 'OT1',
  fanOutput: 'OT2',
  baud: 115200,
};

/** "Minimum fan while heating", in % steps of 5; 0 is off (docs/spec/roasters.md). */
export const MIN_FAN_HEATING = { minPct: 0, maxPct: 100, stepPct: 5 } as const;
