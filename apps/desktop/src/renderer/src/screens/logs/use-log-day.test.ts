import { MAX_LOG_RECORDS, type LogRecord } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { mergeLive } from './use-log-day';

const r = (event: string): LogRecord => ({
  time: '2026-11-03T10:00:00.000Z',
  level: 'info',
  scope: 'app',
  event,
});

describe('mergeLive', () => {
  it('adds live entries the file did not have yet', () => {
    const merged = mergeLive({ records: [r('a'), r('b')], unreadable: 1, truncated: false }, [
      r('b'),
      r('c'),
    ]);
    expect(merged.records.map((x) => x.event)).toEqual(['a', 'b', 'c']);
    expect(merged.unreadable).toBe(1);
  });

  it('keeps the newest entries past the limit and says so', () => {
    const many = Array.from({ length: MAX_LOG_RECORDS }, (_, i) => r(String(i)));
    const merged = mergeLive({ records: many, unreadable: 0, truncated: false }, [r('new')]);
    expect(merged.records).toHaveLength(MAX_LOG_RECORDS);
    expect(merged.records.at(-1)?.event).toBe('new');
    expect(merged.truncated).toBe(true);
  });
});
