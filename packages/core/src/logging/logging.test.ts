import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { fanOut, withMinLevel, type LogSink } from './log-sink';
import { createLogger, silentLogger } from './logger';
import { serializeError, type SerializedError } from './serialize-error';

function memorySink(): LogSink & { entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return { entries, write: (entry) => entries.push(entry) };
}

describe('createLogger', () => {
  it('writes structured entries with scope, event and context', () => {
    const sink = memorySink();
    createLogger(sink, 'session').warn('session.read-failed', { kind: 'no-reply' });
    expect(sink.entries).toEqual([
      {
        level: 'warn',
        scope: 'session',
        event: 'session.read-failed',
        context: { kind: 'no-reply' },
      },
    ]);
  });

  it('leaves context out when there is none', () => {
    const sink = memorySink();
    createLogger(sink, 'app').info('app.started');
    expect(sink.entries).toEqual([{ level: 'info', scope: 'app', event: 'app.started' }]);
  });

  it('narrows the scope for children', () => {
    const sink = memorySink();
    createLogger(sink, 'session').child('monitor').error('safety.stop-failed');
    expect(sink.entries[0]?.scope).toBe('session.monitor');
  });

  it('copies the context, so later changes to the caller object do not rewrite history', () => {
    const sink = memorySink();
    const context = { attempt: 1 };
    createLogger(sink, 'app').info('x', context);
    context.attempt = 2;
    expect(sink.entries[0]?.context).toEqual({ attempt: 1 });
  });

  it('has a silent logger for tests', () => {
    expect(() => {
      silentLogger.child('x').error('y', { z: 1 });
    }).not.toThrow();
  });
});

describe('withMinLevel', () => {
  it('drops entries below the level', () => {
    const sink = memorySink();
    const logger = createLogger(withMinLevel(sink, 'warn'), 'app');
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    expect(sink.entries.map((e) => e.event)).toEqual(['c', 'd']);
  });
});

describe('fanOut', () => {
  it('writes to every sink', () => {
    const a = memorySink();
    const b = memorySink();
    createLogger(
      fanOut([a, b], () => undefined),
      'app',
    ).info('x');
    expect([a.entries.length, b.entries.length]).toEqual([1, 1]);
  });

  it('keeps writing to the others when one sink throws, and reports it', () => {
    const good = memorySink();
    const failures: unknown[] = [];
    const broken: LogSink = {
      write: () => {
        throw new Error('disk full');
      },
    };
    createLogger(
      fanOut([broken, good], (e) => failures.push(e)),
      'app',
    ).error('x');
    expect(good.entries).toHaveLength(1);
    expect(failures).toEqual([new Error('disk full')]);
  });
});

describe('serializeError', () => {
  it('keeps name, message, stack and cause', () => {
    const error = new Error('outer', { cause: new TypeError('inner') });
    const serialized = serializeError(error) as SerializedError;
    expect(serialized).toMatchObject({
      name: 'Error',
      message: 'outer',
      cause: { name: 'TypeError', message: 'inner' },
    });
    expect(typeof serialized.stack).toBe('string');
  });

  it('passes through things that are not errors', () => {
    expect(serializeError('boom')).toBe('boom');
    expect(serializeError({ code: 7 })).toEqual({ code: 7 });
  });
});
