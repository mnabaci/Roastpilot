import { ManualClock, silentLogger } from '@roastpilot/core';
import { SimulatedDriver, Tc4Driver } from '@roastpilot/drivers';
import { RoasterModelSchema } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { createDriver } from './driver-factory';
import { ROASTER_MODELS } from './roaster-models';

const deps = { clock: new ManualClock(), logger: silentLogger };

describe('ROASTER_MODELS', () => {
  it('has a definition for every model id', () => {
    expect(ROASTER_MODELS.all.map((m) => m.id)).toEqual(RoasterModelSchema.options);
  });
});

describe('createDriver', () => {
  it('builds the Skywalker driver for a Skywalker on a serial port', () => {
    const made = createDriver({ model: 'skywalker' }, { kind: 'serial', path: 'COM3' }, deps);
    expect(made.ok && made.value).toBeInstanceOf(Tc4Driver);
  });

  it('builds the simulator for a Simulator', () => {
    const made = createDriver({ model: 'simulator' }, { kind: 'simulator' }, deps);
    expect(made.ok && made.value).toBeInstanceOf(SimulatedDriver);
  });

  it('refuses a port for the Simulator instead of building the Skywalker driver', () => {
    expect(createDriver({ model: 'simulator' }, { kind: 'serial', path: 'COM3' }, deps)).toEqual({
      ok: false,
      error: { kind: 'wrong-connection', model: 'simulator', expected: 'simulator' },
    });
  });

  it('refuses the simulator target for a Skywalker', () => {
    const made = createDriver({ model: 'skywalker' }, { kind: 'simulator' }, deps);
    expect(made.ok).toBe(false);
  });
});
