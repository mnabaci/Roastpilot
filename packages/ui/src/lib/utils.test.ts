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

describe('cn with design-token type styles', () => {
  it('keeps a type style and a text colour together', () => {
    expect(cn('text-body text-on-critical')).toBe('text-body text-on-critical');
  });

  it('lets a later type style replace an earlier one', () => {
    expect(cn('text-body', 'text-heading')).toBe('text-heading');
  });
});
