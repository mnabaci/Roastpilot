import type { LogRecord } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { countLevels, DEFAULT_LEVELS, filterLogs, scopesOf } from './log-filter';

const r = (
  event: string,
  level: LogRecord['level'],
  scope = 'app',
  context?: unknown,
): LogRecord => ({
  time: '2026-11-03T10:00:00.000Z',
  level,
  scope,
  event,
  ...(context === undefined ? {} : { context }),
});

const records = [
  r('app.started', 'info'),
  r('session.connect-failed', 'warn', 'app.session', { error: { kind: 'no-reply' } }),
  r('safety.tripped', 'error', 'app.session', { rule: 'max-temperature' }),
  r('poll', 'debug', 'app.driver'),
];

describe('filterLogs', () => {
  it('opens on errors and warnings, newest first', () => {
    expect(
      filterLogs(records, { levels: DEFAULT_LEVELS, scopes: new Set(), text: '' }).map(
        (x) => x.event,
      ),
    ).toEqual(['safety.tripped', 'session.connect-failed']);
  });

  it('narrows to the picked scopes', () => {
    const all = new Set(['error', 'warn', 'info', 'debug'] as const);
    expect(
      filterLogs(records, { levels: all, scopes: new Set(['app.driver']), text: '' }).map(
        (x) => x.event,
      ),
    ).toEqual(['poll']);
  });

  it('searches event, scope and context, ignoring case', () => {
    const all = new Set(['error', 'warn', 'info', 'debug'] as const);
    const find = (text: string) =>
      filterLogs(records, { levels: all, scopes: new Set(), text }).map((x) => x.event);
    expect(find('NO-REPLY')).toEqual(['session.connect-failed']);
    expect(find('max-temp')).toEqual(['safety.tripped']);
    expect(find('app.driver')).toEqual(['poll']);
    expect(find('  ')).toHaveLength(4);
  });
});

describe('scopesOf and countLevels', () => {
  it('lists each scope once, sorted', () => {
    expect(scopesOf(records)).toEqual(['app', 'app.driver', 'app.session']);
  });

  it('counts every level', () => {
    expect(countLevels(records)).toEqual({ error: 1, warn: 1, info: 1, debug: 1 });
  });
});
