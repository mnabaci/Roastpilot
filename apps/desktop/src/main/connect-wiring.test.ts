import { ManualClock, silentLogger, type RoasterSession } from '@roastpilot/core';
import { BUILT_IN_ROASTERS } from '@roastpilot/drivers';
import {
  DEFAULT_TC4_WIRING,
  err,
  ok,
  READY_ROAST,
  type ConnectionState,
  type Roaster,
} from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { connectWiring } from './connect-wiring';
import type { RoasterService } from './roasters/roaster-service';

// The built-ins are always there; a test can't run without them.
const [skywalker, simulator] = BUILT_IN_ROASTERS;
if (!skywalker || !simulator) throw new Error('no built-in roasters');
const popper: Roaster = { ...skywalker, id: 3, model: 'tc4', wiring: DEFAULT_TC4_WIRING };
const PORT = { kind: 'serial', path: 'COM3' } as const;

function setup(active: Roaster, connection: ConnectionState = { status: 'disconnected' }) {
  const connect = vi.fn(() => Promise.resolve(ok(undefined)));
  const session = { connection, connect } as unknown as RoasterSession;
  const roasters = {
    active: () => active,
    saveWiring: vi.fn(() => Promise.resolve(ok(active))),
  } as unknown as RoasterService;
  const wiring = connectWiring({
    roasters,
    session,
    roast: { state: READY_ROAST },
    attach: (driver) => driver,
    clock: new ManualClock(),
    logger: silentLogger,
  });
  return { ...wiring, connect };
}

describe('connectWiring', () => {
  it("builds the active roaster's driver for Connect", () => {
    const { createDriver } = setup(simulator);
    expect(createDriver({ kind: 'simulator' }).ok).toBe(true);
  });

  it('a generic TC4 that Connect built can read its inputs once connected', async () => {
    const { createDriver, tc4 } = setup(popper, {
      status: 'connected',
      target: PORT,
      channels: [],
    });
    expect(createDriver(PORT).ok).toBe(true);
    // Not opened in this test, so the driver says it is disconnected, not that it can't.
    expect(await tc4.readInputs()).toEqual(err({ kind: 'disconnected' }));
  });

  it('reconnects the roaster in use to its same target after a wiring save', async () => {
    const { tc4, connect } = setup(popper, { status: 'connected', target: PORT, channels: [] });
    await tc4.saveWiring({ id: popper.id, wiring: DEFAULT_TC4_WIRING, minFanHeatingPct: 0 });
    expect(connect).toHaveBeenCalledWith(expect.anything(), PORT);
  });

  it('only saves when nothing is connected', async () => {
    const { tc4, connect } = setup(popper);
    await tc4.saveWiring({ id: popper.id, wiring: DEFAULT_TC4_WIRING, minFanHeatingPct: 0 });
    expect(connect).not.toHaveBeenCalled();
  });

  it("says why when the roaster's model can't use that target", async () => {
    const { tc4, connect } = setup(popper, {
      status: 'connected',
      target: { kind: 'simulator' },
      channels: [],
    });
    expect(
      await tc4.saveWiring({ id: popper.id, wiring: DEFAULT_TC4_WIRING, minFanHeatingPct: 0 }),
    ).toEqual(
      err({
        kind: 'reconnect-failed',
        error: { kind: 'wrong-connection', model: 'tc4', expected: 'serial' },
      }),
    );
    expect(connect).not.toHaveBeenCalled();
  });
});
