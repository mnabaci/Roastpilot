import { describe, expect, it } from 'vitest';
import { formatLogLine } from './format-log-line';

const time = new Date('2026-11-02T21:00:00.000Z');

describe('formatLogLine', () => {
  it('writes errors in the context with name, message and stack', () => {
    const line = formatLogLine(
      { level: 'error', scope: 'app', event: 'x', context: { error: new Error('boom') } },
      time,
    );
    const parsed = JSON.parse(line) as {
      context: { error: { name: string; message: string; stack: unknown } };
    };
    expect(parsed.context.error).toMatchObject({ name: 'Error', message: 'boom' });
    expect(typeof parsed.context.error.stack).toBe('string');
  });

  it('ends with a newline and starts with the time', () => {
    const line = formatLogLine({ level: 'info', scope: 'app', event: 'x' }, time);
    expect(line.endsWith('\n')).toBe(true);
    expect(Object.keys(JSON.parse(line) as object)[0]).toBe('time');
  });

  it('keeps the line when the context cannot be serialized', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const line = formatLogLine(
      { level: 'warn', scope: 'app', event: 'x', context: circular },
      time,
    );
    expect(JSON.parse(line)).toEqual({
      time: time.toISOString(),
      level: 'warn',
      scope: 'app',
      event: 'x',
      context: '[unserializable]',
    });
  });

  it('writes bigints as strings', () => {
    const line = formatLogLine(
      { level: 'info', scope: 'app', event: 'x', context: { big: 10n } },
      time,
    );
    expect(JSON.parse(line)).toMatchObject({ context: { big: '10' } });
  });
});
