import { vi, type Mocked } from 'vitest';

/**
 * Wraps every function of `fake` in a `vi.fn` that runs it, so a test can assert calls or change
 * an answer (`mockResolvedValue`). A function that is already a mock is kept as it is.
 */
export function withSpies<T extends object>(fake: T): Mocked<T> {
  const spied = Object.fromEntries(
    Object.entries(fake).map(([name, value]) => [
      name,
      typeof value === 'function' && !vi.isMockFunction(value) ? vi.fn(value) : value,
    ]),
  );
  // Same keys as `fake`, each function now a mock of itself.
  return spied as Mocked<T>;
}
