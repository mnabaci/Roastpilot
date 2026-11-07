import type { SoundVoice } from '@roastpilot/shared';

/** One oscillator of a note: its wave, its pitch as a multiple of the note's, its share of the peak. */
export interface Layer {
  type: OscillatorType;
  ratio: number;
  share: number;
}

/** One note: its pitch, when it starts after the sound does, and how long it rings, in seconds. */
export interface Note {
  hz: number;
  atS: number;
  forS: number;
}

/** A voice: its loudness at 100 %, the timbre every note shares, and its notes. */
export interface Voice {
  peak: number;
  layers: readonly Layer[];
  notes: readonly Note[];
}

/** Peak gain at 100 %, before the compressor: loud enough over a roaster's fan. Tune here. */
export const PEAK: Readonly<Record<Exclude<SoundVoice, 'none'>, number>> = {
  chime: 0.7,
  ping: 0.55,
  alert: 0.8,
  bell: 0.7,
  marimba: 0.7,
  // A square wave is loud for its gain.
  beep: 0.35,
};

/** Triangle at the note, a sine an octave up: bright enough to carry. */
const BRIGHT: readonly Layer[] = [
  { type: 'triangle', ratio: 1, share: 1 },
  { type: 'sine', ratio: 2, share: 0.35 },
];

export const VOICES: Readonly<Record<SoundVoice, Voice>> = {
  // Rising: something needs you.
  chime: {
    peak: PEAK.chime,
    layers: BRIGHT,
    notes: [
      { hz: 660, atS: 0, forS: 0.18 },
      { hz: 880, atS: 0.2, forS: 0.3 },
    ],
  },
  ping: { peak: PEAK.ping, layers: BRIGHT, notes: [{ hz: 587, atS: 0, forS: 0.45 }] },
  // Low and twice.
  alert: {
    peak: PEAK.alert,
    layers: BRIGHT,
    notes: [
      { hz: 330, atS: 0, forS: 0.2 },
      { hz: 330, atS: 0.3, forS: 0.28 },
    ],
  },
  // Struck, with a bell's out-of-tune partials, ringing out.
  bell: {
    peak: PEAK.bell,
    layers: [
      { type: 'sine', ratio: 1, share: 1 },
      { type: 'sine', ratio: 2.76, share: 0.2 },
      { type: 'sine', ratio: 5.4, share: 0.08 },
    ],
    notes: [{ hz: 784, atS: 0, forS: 1.2 }],
  },
  marimba: {
    peak: PEAK.marimba,
    layers: [
      { type: 'sine', ratio: 1, share: 1 },
      { type: 'sine', ratio: 4, share: 0.25 },
    ],
    notes: [
      { hz: 523, atS: 0, forS: 0.25 },
      { hz: 659, atS: 0.16, forS: 0.25 },
    ],
  },
  beep: {
    peak: PEAK.beep,
    layers: [{ type: 'square', ratio: 1, share: 1 }],
    notes: [
      { hz: 1000, atS: 0, forS: 0.09 },
      { hz: 1000, atS: 0.15, forS: 0.09 },
    ],
  },
  none: { peak: 0, layers: [], notes: [] },
};

/** What the voices are called in Settings. */
export const VOICE_LABEL: Readonly<Record<SoundVoice, string>> = {
  chime: 'Chime',
  ping: 'Ping',
  alert: 'Alert',
  bell: 'Bell',
  marimba: 'Marimba',
  beep: 'Beep',
  none: 'None',
};
