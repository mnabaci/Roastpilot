import { describe, expect, it, vi } from 'vitest';
import { withSpies } from './with-spies';

describe('withSpies', () => {
  it('wraps each function in a spy that still answers as the fake does', () => {
    const spied = withSpies({ twice: (n: number) => n * 2, name: 'fake' });

    expect(spied.twice(3)).toBe(6);
    expect(spied.twice).toHaveBeenCalledWith(3);
    expect(spied.name).toBe('fake');
  });

  it('keeps a function that is already a mock, so the test can hold on to it', () => {
    const own = vi.fn(() => 1);
    const spied = withSpies({ own });

    spied.own();

    expect(spied.own).toBe(own);
    expect(own).toHaveBeenCalledOnce();
  });
});
