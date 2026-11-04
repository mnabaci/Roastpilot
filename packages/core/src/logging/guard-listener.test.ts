import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { guardListener } from './guard-listener';
import { createLogger } from './logger';

describe('guardListener', () => {
  it('passes the payload on', () => {
    const seen: number[] = [];
    const logger = createLogger({ write: () => undefined }, 'test');
    guardListener(logger, 'x.listener-failed', (n: number) => seen.push(n))(3);
    expect(seen).toEqual([3]);
  });

  it('logs a throw with its context instead of throwing', () => {
    const entries: LogEntry[] = [];
    const logger = createLogger({ write: (e) => entries.push(e) }, 'test');
    const guarded = guardListener(
      logger,
      'x.listener-failed',
      () => {
        throw new Error('boom');
      },
      { listener: 'onReading' },
    );
    expect(() => {
      guarded(undefined);
    }).not.toThrow();
    expect(entries[0]).toMatchObject({
      level: 'error',
      event: 'x.listener-failed',
      context: { listener: 'onReading', error: { message: 'boom' } },
    });
  });
});
