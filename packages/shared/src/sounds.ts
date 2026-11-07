import { z } from 'zod';

/**
 * The moments that can play a sound (docs/spec/ui.md, Sounds), in the order they happen in a roast;
 * Auto stopped is last because it can happen at any point. Settings lists them in this order.
 */
export const SoundStepSchema = z.enum([
  'charge-soon',
  'beans-in',
  'listen-first-crack',
  'dump-beans',
  'auto-stopped',
]);

/** What a step sounds like; all synthesised in the window, `none` is silent. */
export const SoundVoiceSchema = z.enum([
  'chime',
  'ping',
  'alert',
  'bell',
  'marimba',
  'beep',
  'none',
]);

/** 0–100 %, in steps of 5. */
export const VolumePctSchema = z.number().int().min(0).max(100).multipleOf(5);

/** How often a step plays: 1–3 times, 3 s apart, or every 10 s while the step still waits (≤ 1 min). */
export const SoundRepeatSchema = z.enum(['once', 'twice', 'thrice', 'until-done']);

export const StepSoundSchema = z.object({
  voice: SoundVoiceSchema,
  volumePct: VolumePctSchema,
  repeat: SoundRepeatSchema,
});

export type SoundStep = z.infer<typeof SoundStepSchema>;
export type SoundVoice = z.infer<typeof SoundVoiceSchema>;
export type SoundRepeat = z.infer<typeof SoundRepeatSchema>;
export type StepSound = z.infer<typeof StepSoundSchema>;

export const DEFAULT_STEP_SOUNDS: Readonly<Record<SoundStep, StepSound>> = {
  'charge-soon': { voice: 'chime', volumePct: 80, repeat: 'until-done' },
  'beans-in': { voice: 'chime', volumePct: 80, repeat: 'until-done' },
  'listen-first-crack': { voice: 'ping', volumePct: 70, repeat: 'once' },
  'dump-beans': { voice: 'chime', volumePct: 80, repeat: 'twice' },
  'auto-stopped': { voice: 'alert', volumePct: 90, repeat: 'thrice' },
};

/** One step's sound; a bad voice, volume or repeat falls back to that step's default on its own. */
const stepSound = (step: SoundStep) => {
  const fallback = DEFAULT_STEP_SOUNDS[step];
  return z
    .object({
      voice: SoundVoiceSchema.catch(fallback.voice).default(fallback.voice),
      volumePct: VolumePctSchema.catch(fallback.volumePct).default(fallback.volumePct),
      repeat: SoundRepeatSchema.catch(fallback.repeat).default(fallback.repeat),
    })
    .catch({ ...fallback })
    .default({ ...fallback });
};

export const SoundsSchema = z.object({
  enabled: z.boolean().catch(true).default(true),
  steps: z
    .object({
      'charge-soon': stepSound('charge-soon'),
      'beans-in': stepSound('beans-in'),
      'listen-first-crack': stepSound('listen-first-crack'),
      'dump-beans': stepSound('dump-beans'),
      'auto-stopped': stepSound('auto-stopped'),
    })
    .catch({ ...DEFAULT_STEP_SOUNDS })
    .default({ ...DEFAULT_STEP_SOUNDS }),
});

export type Sounds = z.infer<typeof SoundsSchema>;

export const DEFAULT_SOUNDS: Sounds = SoundsSchema.parse({});
