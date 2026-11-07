import { describe, expect, it, vi } from 'vitest';
import { silentLogger } from '../logging/logger';
import { STUCK_TICK_MS, TickGate } from './tick-gate';

describe('TickGate', () => {
  it('skips a reading while the last tick still runs', async () => {
    const gate = new TickGate(silentLogger);
    let finish: () => void = () => undefined;
    const first = gate.run(
      0,
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const second = vi.fn(() => Promise.resolve());
    await gate.run(1_000, second);
    expect(second).not.toHaveBeenCalled();
    finish();
    await first;
    await gate.run(2_000, second);
    expect(second).toHaveBeenCalledOnce();
  });

  it(`logs once when a tick holds up readings for ${String(STUCK_TICK_MS / 1000)} s`, async () => {
    const error = vi.fn();
    const gate = new TickGate({ ...silentLogger, error });
    void gate.run(0, () => new Promise<void>(() => undefined));
    for (let atMs = 1_000; atMs <= 9_000; atMs += 1_000) await gate.run(atMs, vi.fn());
    expect(error).toHaveBeenCalledExactlyOnceWith('auto.tick-stuck', { forMs: STUCK_TICK_MS });
  });
});
