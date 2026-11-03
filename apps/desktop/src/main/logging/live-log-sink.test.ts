import type { LogRecord } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { liveLogSink } from './live-log-sink';

function setup(publish: (records: LogRecord[]) => void = vi.fn()) {
  const pending: (() => void)[] = [];
  const onError = vi.fn();
  const sink = liveLogSink({
    publish,
    schedule: (flush) => pending.push(flush),
    now: () => new Date('2026-11-03T10:00:00.000Z'),
    onError,
  });
  const tick = () => {
    for (const flush of pending.splice(0)) flush();
  };
  return { sink, tick, onError };
}

describe('liveLogSink', () => {
  it('only queues on write, then sends one batch per tick with the time added', () => {
    const publish = vi.fn();
    const { sink, tick } = setup(publish);
    sink.write({ level: 'info', scope: 'app', event: 'a' });
    sink.write({ level: 'warn', scope: 'app', event: 'b' });
    expect(publish).not.toHaveBeenCalled();
    tick();
    expect(publish).toHaveBeenCalledExactlyOnceWith([
      { time: '2026-11-03T10:00:00.000Z', level: 'info', scope: 'app', event: 'a' },
      { time: '2026-11-03T10:00:00.000Z', level: 'warn', scope: 'app', event: 'b' },
    ]);
  });

  it('starts a new batch after a send', () => {
    const publish = vi.fn();
    const { sink, tick } = setup(publish);
    sink.write({ level: 'info', scope: 'app', event: 'a' });
    tick();
    sink.write({ level: 'info', scope: 'app', event: 'b' });
    tick();
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish.mock.lastCall?.[0]).toEqual([expect.objectContaining({ event: 'b' })]);
  });

  it('a failing send is reported, never thrown, and the next batch still goes', () => {
    const publish = vi.fn().mockImplementationOnce(() => {
      throw new Error('window gone');
    });
    const { sink, tick, onError } = setup(publish);
    sink.write({ level: 'info', scope: 'app', event: 'a' });
    expect(tick).not.toThrow();
    expect(onError).toHaveBeenCalledOnce();
    sink.write({ level: 'info', scope: 'app', event: 'b' });
    tick();
    expect(publish).toHaveBeenCalledTimes(2);
  });
});
