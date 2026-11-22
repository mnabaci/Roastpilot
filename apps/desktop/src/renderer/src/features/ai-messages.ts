import type { AiReadError } from '@roastpilot/shared';

/** What to do instead when a read fails: tap the tags, or fill the fields. */
type Fallback = 'tags' | 'fields';

const FALLBACKS: Readonly<Record<Fallback, string>> = {
  tags: 'tap the tags yourself',
  fields: 'fill the fields yourself',
};

/** A failed read in one line (docs/spec/ai-helpers.md, When it fails); nothing typed is lost. */
export function aiReadMessage(error: AiReadError, fallback: Fallback): string {
  switch (error.kind) {
    case 'off':
      return 'AI helpers are off · turn them on in Settings';
    case 'no-key':
      return 'No API key that reads this · add one in Settings';
    case 'key-refused':
      return 'The API key was refused · check it in Settings';
    case 'rate-limited':
      return 'Too many requests · try again in a minute';
    case 'offline':
      return "Couldn't reach the AI · check your connection";
    case 'unreadable':
      return `Couldn't read that · ${FALLBACKS[fallback]}`;
    case 'failed':
      return "The AI didn't answer · see Logs";
    case 'model-retired':
      return 'This AI model was retired · update Roastpilot';
    case 'too-long':
      return `Too long · up to ${error.limit}`;
    case 'busy':
      return 'Still reading the last one · a moment';
  }
}
