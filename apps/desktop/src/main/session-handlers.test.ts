import { ReadingHistory } from '@roastpilot/core';
import { IPC_CHANNELS, type SafetyEvent } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { sessionHandlers } from './session-handlers';

const READING = { atMs: 1_000, values: { bt: 150, heater: 60 } };
const SIM = { kind: 'simulator' } as const;

function setup({ failing = false } = {}) {
  const fail = () => Promise.reject(new Error('bug'));
  const done = () => Promise.resolve();
  const roast = {
    onReading: vi.fn(failing ? fail : done),
    restoreOutputs: vi.fn(failing ? fail : done),
    stopRoasterCooling: vi.fn(),
  };
  const pilot = { onReading: vi.fn(failing ? fail : done), stop: vi.fn() };
  const coach = { onReading: vi.fn(), sync: vi.fn(), stop: vi.fn() };
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() };
  const published: string[] = [];
  const history = new ReadingHistory();
  const handlers = sessionHandlers({
    history,
    recorder: { onReading: vi.fn() },
    parts: () => ({ roast, pilot, coach }),
    publish: (channel) => {
      published.push(channel);
    },
    onConnectionChange: vi.fn(),
    logger,
  });
  return { handlers, roast, pilot, coach, logger, published, history };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('sessionHandlers', () => {
  it('keeps each reading, then passes it to the window, the roast, Auto and the coach', () => {
    const { handlers, roast, pilot, coach, published, history } = setup();
    handlers.onReading(READING);
    expect(history.all()).toEqual([READING]);
    expect(published).toEqual([IPC_CHANNELS.reading]);
    expect(roast.onReading).toHaveBeenCalledWith(READING);
    expect(pilot.onReading).toHaveBeenCalledWith(READING);
    expect(coach.onReading).toHaveBeenCalledWith(READING);
  });

  it('logs a roast or Auto that fails on a reading, and the coach still hears it', async () => {
    const { handlers, coach, logger } = setup({ failing: true });
    handlers.onReading(READING);
    await flush();
    expect(logger.error).toHaveBeenCalledWith('roast.reading-failed', expect.anything());
    expect(logger.error).toHaveBeenCalledWith('auto.reading-failed', expect.anything());
    expect(coach.onReading).toHaveBeenCalledWith(READING);
  });

  it('logs outputs that could not be put back after a new connection', async () => {
    const { handlers, coach, logger } = setup({ failing: true });
    handlers.onConnection({ status: 'connected', target: SIM, channels: [] });
    await flush();
    expect(logger.error).toHaveBeenCalledWith('roast.restore-failed', expect.anything());
    expect(coach.sync).toHaveBeenCalled();
  });

  it('a lost connection stops Auto and lets the coach take its card away', () => {
    const { handlers, roast, pilot, coach } = setup();
    handlers.onConnection({ status: 'lost', target: SIM });
    expect(roast.stopRoasterCooling).not.toHaveBeenCalled();
    expect(pilot.stop).toHaveBeenCalledWith('lost');
    expect(coach.sync).toHaveBeenCalled();
  });

  it('a safe stop stops cooling the roaster, Auto and the coach', () => {
    const { handlers, roast, pilot, coach } = setup();
    const trip: SafetyEvent = { kind: 'tripped', rule: 'max-temp', action: 'safe-stop', atMs: 0 };
    handlers.onSafetyEvent(trip);
    expect(roast.stopRoasterCooling).toHaveBeenCalledWith('safety-stop');
    expect(pilot.stop).toHaveBeenCalledWith('safety-stop');
    expect(coach.stop).toHaveBeenCalled();
  });
});
