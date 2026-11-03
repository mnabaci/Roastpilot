import { describe, expect, it } from 'vitest';
import { WINDOW_BACKGROUND } from './window-background';

describe('WINDOW_BACKGROUND', () => {
  it('is the dark bg token, as a colour Electron accepts', () => {
    expect(WINDOW_BACKGROUND).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
