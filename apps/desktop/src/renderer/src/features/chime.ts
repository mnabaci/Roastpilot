import { serializeError, type Logger } from '@roastpilot/core';
import type { SoundVoice } from '@roastpilot/shared';
import { VOICES, type Layer, type Note } from './voices';

/** Plays a voice at a volume and returns at once; a sound that can't play is logged, never thrown. */
export interface ChimePlayer {
  play(voice: SoundVoice, volumePct: number): void;
}

const ATTACK_S = 0.01;
const SILENT = 0.0001;

/** One layer of a note: an oscillator through its own envelope into `out`. */
function playLayer(
  context: AudioContext,
  out: AudioNode,
  note: Note,
  layer: Layer,
  peak: number,
): void {
  const startS = context.currentTime + note.atS;
  const endS = startS + note.forS;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = layer.type;
  oscillator.frequency.value = note.hz * layer.ratio;
  gain.gain.setValueAtTime(SILENT, startS);
  gain.gain.linearRampToValueAtTime(Math.max(peak * layer.share, SILENT), startS + ATTACK_S);
  gain.gain.exponentialRampToValueAtTime(SILENT, endS);
  oscillator.connect(gain).connect(out);
  oscillator.start(startS);
  oscillator.stop(endS + 0.02);
}

const webAudio = (): AudioContext | undefined =>
  typeof AudioContext === 'undefined' ? undefined : new AudioContext();

/**
 * Voices synthesised with the Web Audio API, no files, through one compressor so they carry over a
 * roaster's fan without clipping. The context is made on the first sound and resumed when the
 * window has suspended it; if sound can't play, that is logged once.
 */
export function createWebAudioChimePlayer(
  logger: Logger,
  makeContext: () => AudioContext | undefined = webAudio,
): ChimePlayer {
  let audio: { context: AudioContext; out: AudioNode } | undefined;
  let warned = false;
  const cannotPlay = (error: unknown) => {
    if (warned) return;
    warned = true;
    logger.warn('sound.cannot-play', { error: serializeError(error) });
  };
  const opened = () => {
    if (audio) return audio;
    try {
      const context = makeContext();
      if (!context) cannotPlay(new Error('No Web Audio in this window'));
      else
        audio = { context, out: context.createDynamicsCompressor().connect(context.destination) };
    } catch (error) {
      cannotPlay(error);
    }
    return audio;
  };
  return {
    play(voice, volumePct) {
      const { peak, layers, notes } = VOICES[voice];
      const scaled = (peak * Math.min(Math.max(volumePct, 0), 100)) / 100;
      // Silent: no context is opened for nothing.
      if (notes.length === 0 || scaled <= 0) return;
      const opening = opened();
      if (!opening) return;
      const { context, out } = opening;
      const ready = context.state === 'suspended' ? context.resume() : Promise.resolve();
      ready
        .then(() => {
          for (const note of notes)
            for (const layer of layers) playLayer(context, out, note, layer, scaled);
        })
        .catch(cannotPlay);
    },
  };
}
