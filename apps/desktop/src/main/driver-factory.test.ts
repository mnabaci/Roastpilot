import {
  FanInterlockDriver,
  ManualClock,
  silentLogger,
  type RoasterDriver,
} from '@roastpilot/core';
import { SimulatedDriver, Tc4Driver } from '@roastpilot/drivers';
import { DEFAULT_TC4_WIRING, RoasterModelSchema } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { createDriver } from './driver-factory';
import { ROASTER_MODELS } from './roaster-models';

const deps = { clock: new ManualClock(), logger: silentLogger };

describe('ROASTER_MODELS', () => {
  it('has a definition for every model id', () => {
    expect(ROASTER_MODELS.all.map((m) => m.id)).toEqual(RoasterModelSchema.options);
  });
});

const PLAIN = { wiring: null, minFanHeatingPct: 0 } as const;

describe('createDriver', () => {
  it('builds the Skywalker driver for a Skywalker on a serial port', () => {
    const made = createDriver(
      { ...PLAIN, model: 'skywalker' },
      { kind: 'serial', path: 'COM3' },
      deps,
    );
    expect(made.ok && made.value).toBeInstanceOf(Tc4Driver);
  });

  it('builds the simulator for a Simulator', () => {
    const made = createDriver({ ...PLAIN, model: 'simulator' }, { kind: 'simulator' }, deps);
    expect(made.ok && made.value).toBeInstanceOf(SimulatedDriver);
  });

  it('refuses a port for the Simulator instead of building the Skywalker driver', () => {
    expect(
      createDriver({ ...PLAIN, model: 'simulator' }, { kind: 'serial', path: 'COM3' }, deps),
    ).toEqual({
      ok: false,
      error: { kind: 'wrong-connection', model: 'simulator', expected: 'simulator' },
    });
  });

  it('builds a generic TC4 from its wiring and hands the bare driver to onBuilt', () => {
    const built: RoasterDriver[] = [];
    const made = createDriver(
      { model: 'tc4', wiring: DEFAULT_TC4_WIRING, minFanHeatingPct: 0 },
      { kind: 'serial', path: 'COM3' },
      deps,
      (driver) => built.push(driver),
    );
    expect(made.ok && made.value).toBeInstanceOf(Tc4Driver);
    expect(built).toHaveLength(1);
    expect(made.ok && made.value).toBe(built[0]);
  });

  it('puts the minimum fan in front of the driver when the record sets one', () => {
    const built: RoasterDriver[] = [];
    const made = createDriver(
      { model: 'tc4', wiring: DEFAULT_TC4_WIRING, minFanHeatingPct: 30 },
      { kind: 'serial', path: 'COM3' },
      deps,
      (driver) => built.push(driver),
    );
    expect(made.ok && made.value).toBeInstanceOf(FanInterlockDriver);
    expect(built[0]).toBeInstanceOf(Tc4Driver);
  });

  it('refuses the simulator target for a Skywalker', () => {
    const made = createDriver({ ...PLAIN, model: 'skywalker' }, { kind: 'simulator' }, deps);
    expect(made.ok).toBe(false);
  });
});
