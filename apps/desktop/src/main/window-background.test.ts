import { describe, expect, it } from 'vitest';
import { windowBackground } from './window-background';

describe('windowBackground', () => {
  it('is the bg token of each theme, as a colour Electron accepts', () => {
    expect(windowBackground(true)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(windowBackground(false)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(windowBackground(true)).not.toBe(windowBackground(false));
  });
});
