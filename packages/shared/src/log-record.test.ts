import { describe, expect, it } from 'vitest';
import { LogDaySchema, LogRecordSchema } from './log-record';

describe('LogDaySchema', () => {
  it('accepts a calendar day', () => {
    expect(LogDaySchema.safeParse('2026-11-03').success).toBe(true);
  });

  it.each(['../etc/passwd', '2026-11-03.log', '2026-11-3', '2026-11-03/../x', ''])(
    'rejects %j, so it can only ever name a log file',
    (day) => {
      expect(LogDaySchema.safeParse(day).success).toBe(false);
    },
  );
});

describe('LogRecordSchema', () => {
  it('reads a line as the file sink writes it', () => {
    const line = {
      time: '2026-11-03T10:00:00.000Z',
      level: 'warn',
      scope: 'app.session',
      event: 'session.connect-failed',
      context: { error: { kind: 'no-reply' } },
    };
    expect(LogRecordSchema.parse(line)).toEqual(line);
  });

  it('keeps an unserializable context marker', () => {
    expect(
      LogRecordSchema.parse({
        time: 't',
        level: 'info',
        scope: 's',
        event: 'e',
        context: '[unserializable]',
      }).context,
    ).toBe('[unserializable]');
  });

  it('rejects an unknown level', () => {
    expect(
      LogRecordSchema.safeParse({ time: 't', level: 'fatal', scope: 's', event: 'e' }).success,
    ).toBe(false);
  });
});
