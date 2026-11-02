import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('lets the later Tailwind class win', () => {
    expect(cn('p-2 text-ink', 'p-4')).toBe('text-ink p-4');
  });

  it('drops falsy values', () => {
    expect(cn('bg-surface', null, undefined, false)).toBe('bg-surface');
  });
});
