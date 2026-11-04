import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../logging/logger';
import { logSafetyEvent } from './log-safety-event';

function logged(...events: Parameters<typeof logSafetyEvent>[1][]) {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'safety');
  for (const event of events) logSafetyEvent(logger, event);
  return entries.map((e) => `${e.level}:${e.event}`);
}

describe('logSafetyEvent', () => {
  it('a safe stop is an error, an alarm a warning', () => {
    expect(
      logged(
        { kind: 'tripped', rule: 'max-temperature', action: 'safe-stop', atMs: 0 },
        { kind: 'tripped', rule: 'slow-rise', action: 'alarm', atMs: 0 },
      ),
    ).toEqual(['error:safety.tripped', 'warn:safety.tripped']);
  });

  it('clears and unlocks are info', () => {
    expect(
      logged({ kind: 'cleared', rule: 'slow-rise', atMs: 0 }, { kind: 'unlocked', atMs: 0 }),
    ).toEqual(['info:safety.cleared', 'info:safety.unlocked']);
  });
});
