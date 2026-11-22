import { describe, expect, it } from 'vitest';
import { aiReadMessage } from './ai-messages';

describe('aiReadMessage', () => {
  it('says to update the app when every model is retired, naming no provider', () => {
    expect(aiReadMessage({ kind: 'model-retired', provider: 'alpha' }, 'tags')).toBe(
      'This AI model was retired · update Roastpilot',
    );
  });

  it('offers the right thing to do by hand when nothing could be read', () => {
    expect(aiReadMessage({ kind: 'unreadable', provider: 'alpha' }, 'tags')).toBe(
      "Couldn't read that · tap the tags yourself",
    );
    expect(aiReadMessage({ kind: 'unreadable', provider: 'alpha' }, 'fields')).toBe(
      "Couldn't read that · fill the fields yourself",
    );
  });

  it('names the limit a read went over', () => {
    expect(aiReadMessage({ kind: 'too-long', limit: '20 pages' }, 'fields')).toBe(
      'Too long · up to 20 pages',
    );
  });
});
