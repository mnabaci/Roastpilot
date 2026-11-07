import { describe, expect, it } from 'vitest';
import { isAutoDriven } from './roast-phases';

describe('isAutoDriven', () => {
  it.each(['preheat', 'roasting', 'development'] as const)('drives %s', (phase) => {
    expect(isAutoDriven(phase)).toBe(true);
  });

  it.each(['ready', 'cooling', 'done'] as const)('leaves %s alone', (phase) => {
    expect(isAutoDriven(phase)).toBe(false);
  });
});
