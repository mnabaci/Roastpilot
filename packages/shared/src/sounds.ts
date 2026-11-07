import { z } from 'zod';

/** The moments that can play a sound (docs/spec/ui.md, Sounds). */
export const SoundStepSchema = z.enum([
  'charge-soon',
  'beans-in',
  'dump-beans',
  'listen-first-crack',
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

export const StepSoundSchema = z.object({ voice: SoundVoiceSchema, volumePct: VolumePctSchema });

export type SoundStep = z.infer<typeof SoundStepSchema>;
export type SoundVoice = z.infer<typeof SoundVoiceSchema>;
export type StepSound = z.infer<typeof StepSoundSchema>;

export const DEFAULT_STEP_SOUNDS: Readonly<Record<SoundStep, StepSound>> = {
  'charge-soon': { voice: 'chime', volumePct: 80 },
  'beans-in': { voice: 'chime', volumePct: 80 },
  'dump-beans': { voice: 'chime', volumePct: 80 },
  'listen-first-crack': { voice: 'ping', volumePct: 70 },
  'auto-stopped': { voice: 'alert', volumePct: 90 },
};

/** One step's sound; a bad voice or volume falls back to that step's default on its own. */
const stepSound = (step: SoundStep) => {
  const fallback = DEFAULT_STEP_SOUNDS[step];
  return z
    .object({
      voice: SoundVoiceSchema.catch(fallback.voice).default(fallback.voice),
      volumePct: VolumePctSchema.catch(fallback.volumePct).default(fallback.volumePct),
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
      'dump-beans': stepSound('dump-beans'),
      'listen-first-crack': stepSound('listen-first-crack'),
      'auto-stopped': stepSound('auto-stopped'),
    })
    .catch({ ...DEFAULT_STEP_SOUNDS })
    .default({ ...DEFAULT_STEP_SOUNDS }),
});

export type Sounds = z.infer<typeof SoundsSchema>;

export const DEFAULT_SOUNDS: Sounds = SoundsSchema.parse({});
