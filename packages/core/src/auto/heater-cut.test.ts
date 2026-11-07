import { err, ok, type DriverError, type Result } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { silentLogger } from '../logging/logger';
import { HeaterCut } from './heater-cut';

const FAILED = err<DriverError>({ kind: 'disconnected' });

function setup(...results: (Result<void, DriverError> | Error)[]) {
  const setOutput = vi.fn((_channel: string, _value: number) => {
    const next = results.shift() ?? ok(undefined);
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { cut: new HeaterCut(setOutput, silentLogger), setOutput };
}

describe('HeaterCut', () => {
  it('sends heater 0 once when it lands', async () => {
    const { cut, setOutput } = setup();
    await cut.cut('drop');
    await cut.retry();
    expect(setOutput.mock.calls).toEqual([['heater', 0]]);
    expect(cut.pending).toBe(false);
  });

  it('tries again on every reading until it lands', async () => {
    const { cut, setOutput } = setup(FAILED, new Error('boom'), ok(undefined));
    await cut.cut('drop');
    expect(cut.pending).toBe(true);
    await cut.retry();
    await cut.retry();
    expect(cut.pending).toBe(false);
    await cut.retry();
    expect(setOutput).toHaveBeenCalledTimes(3);
  });

  it('stops trying once you set the heater yourself', async () => {
    const { cut, setOutput } = setup(FAILED);
    await cut.cut('preheat-limit');
    cut.forget();
    await cut.retry();
    expect(setOutput).toHaveBeenCalledTimes(1);
  });
});
