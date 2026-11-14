import type { RoasterDriver } from '@roastpilot/core';
import { err, ok } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { RoasterInputs } from './roaster-inputs';

const plain = { channels: [] } as unknown as RoasterDriver;
const tc4 = (inputs = [210, 165, 22, 22]) =>
  ({ channels: [], readInputs: () => Promise.resolve(ok(inputs)) }) as unknown as RoasterDriver;
const IDLE = { connected: true, roasting: false };

describe('RoasterInputs', () => {
  it('reads the inputs of a connected TC4 that is not roasting', async () => {
    const inputs = new RoasterInputs();
    inputs.attach(tc4());
    expect(await inputs.read(IDLE)).toEqual(ok([210, 165, 22, 22]));
  });

  it('refuses while a roast runs, so polling keeps its readings', async () => {
    const inputs = new RoasterInputs();
    inputs.attach(tc4());
    expect(await inputs.read({ connected: true, roasting: true })).toEqual(
      err({ kind: 'roasting' }),
    );
  });

  it('has nothing to read when not connected, or on a roaster that cannot', async () => {
    const inputs = new RoasterInputs();
    expect(await inputs.read(IDLE)).toEqual(err({ kind: 'unavailable' }));
    inputs.attach(tc4());
    expect(await inputs.read({ connected: false, roasting: false })).toEqual(
      err({ kind: 'unavailable' }),
    );
    inputs.attach(plain);
    expect(await inputs.read(IDLE)).toEqual(err({ kind: 'unavailable' }));
  });
});
