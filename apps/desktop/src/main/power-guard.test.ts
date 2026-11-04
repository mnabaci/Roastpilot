import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { createPowerGuard } from './power-guard';

function setup() {
  const entries: LogEntry[] = [];
  const blocker = { start: vi.fn(() => 7), stop: vi.fn() };
  const emergencyStop = vi.fn();
  const guard = createPowerGuard({
    blocker,
    emergencyStop,
    logger: createLogger({ write: (e) => entries.push(e) }, 'power'),
  });
  return { guard, blocker, emergencyStop, entries };
}

const SIM = { kind: 'simulator' } as const;

describe('createPowerGuard', () => {
  it('keeps the computer awake from connecting until disconnected, once', () => {
    const { guard, blocker } = setup();
    guard.onConnection({ status: 'connecting', target: SIM });
    guard.onConnection({ status: 'connected', target: SIM, channels: [] });
    guard.onConnection({ status: 'lost', target: SIM });
    expect(blocker.start).toHaveBeenCalledOnce();
    expect(blocker.start).toHaveBeenCalledWith('prevent-app-suspension');
    expect(blocker.stop).not.toHaveBeenCalled();
    guard.onConnection({ status: 'disconnected' });
    expect(blocker.stop).toHaveBeenCalledWith(7);
  });

  it('never blocks sleep with no roaster', () => {
    const { guard, blocker } = setup();
    guard.onConnection({ status: 'disconnected' });
    expect(blocker.start).not.toHaveBeenCalled();
    expect(blocker.stop).not.toHaveBeenCalled();
  });

  it('safe-stops under computer-sleep when it sleeps with a roaster, and logs both ways', () => {
    const { guard, emergencyStop, entries } = setup();
    guard.onConnection({ status: 'connected', target: SIM, channels: [] });
    guard.onSuspend();
    guard.onResume();
    expect(emergencyStop).toHaveBeenCalledWith('computer-sleep');
    expect(entries.map((e) => e.event)).toEqual([
      'power.keep-awake-on',
      'power.suspend',
      'power.resume',
    ]);
  });

  it('a sleep with no roaster only logs', () => {
    const { guard, emergencyStop } = setup();
    guard.onSuspend();
    expect(emergencyStop).not.toHaveBeenCalled();
  });
});
