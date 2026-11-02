import { ManualClock, silentLogger } from '@roastpilot/core';
import { SimulatedDriver, Tc4SkywalkerDriver } from '@roastpilot/drivers';
import { describe, expect, it } from 'vitest';
import { createDriver } from './driver-factory';

describe('createDriver', () => {
  it('builds the simulator', () => {
    expect(createDriver({ kind: 'simulator' }, new ManualClock(), silentLogger)).toBeInstanceOf(
      SimulatedDriver,
    );
  });

  it('builds the Skywalker driver for a serial port', () => {
    expect(
      createDriver({ kind: 'serial', path: 'COM3' }, new ManualClock(), silentLogger),
    ).toBeInstanceOf(Tc4SkywalkerDriver);
  });
});
