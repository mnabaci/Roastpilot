import { err, ok, type LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { FailureStreak } from './failure-streak';
import { createLogger } from './logger';

function setup() {
  const entries: LogEntry[] = [];
  const streak = new FailureStreak(
    createLogger({ write: (e) => entries.push(e) }, 'session'),
    'session.read',
  );
  return { entries, streak, events: () => entries.map((e) => e.event) };
}

describe('FailureStreak', () => {
  it('logs nothing while things work', () => {
    const { streak, entries } = setup();
    streak.record(ok(1));
    streak.record(ok(2));
    expect(entries).toEqual([]);
  });

  it('logs a repeating failure once, then the recovery with a count', () => {
    const { streak, entries, events } = setup();
    for (let i = 0; i < 5; i++) streak.record(err({ kind: 'disconnected' }));
    streak.record(ok(1));
    expect(events()).toEqual(['session.read-failed', 'session.read-recovered']);
    expect(entries[0]).toMatchObject({
      level: 'warn',
      context: { error: { kind: 'disconnected' } },
    });
    expect(entries[1]).toMatchObject({ level: 'info', context: { failures: 5 } });
  });

  it('logs again when the kind of failure changes', () => {
    const { streak, events } = setup();
    streak.record(err({ kind: 'no-reply' }));
    streak.record(err({ kind: 'no-reply' }));
    streak.record(err({ kind: 'disconnected' }));
    expect(events()).toEqual(['session.read-failed', 'session.read-failed']);
  });

  it('puts its context on both entries', () => {
    const entries: LogEntry[] = [];
    const streak = new FailureStreak(
      createLogger({ write: (e) => entries.push(e) }, 'serial'),
      'serial.open',
      { path: 'COM3' },
    );
    streak.record(err({ kind: 'disconnected' }));
    streak.record(err({ kind: 'disconnected' }));
    streak.record(ok(undefined));
    expect(entries.map((e) => e.context)).toEqual([
      { path: 'COM3', error: { kind: 'disconnected' } },
      { path: 'COM3', failures: 2 },
    ]);
  });
});
