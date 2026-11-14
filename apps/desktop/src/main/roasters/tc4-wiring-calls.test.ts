import { silentLogger } from '@roastpilot/core';
import { BUILT_IN_ROASTERS } from '@roastpilot/drivers';
import { DEFAULT_TC4_WIRING, err, ok, type ConnectionState } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { tc4WiringCalls } from './tc4-wiring-calls';

// The built-ins are always there; a test can't run without them.
const skywalker = BUILT_IN_ROASTERS[0];
if (!skywalker) throw new Error('no built-in roaster');
const popper = { ...skywalker, id: 3, model: 'tc4' as const, wiring: DEFAULT_TC4_WIRING };
const CONNECTED: ConnectionState = {
  status: 'connected',
  target: { kind: 'serial', path: 'COM3' },
  channels: [],
};
const request = { id: 3, wiring: { ...DEFAULT_TC4_WIRING, etInput: 0 }, minFanHeatingPct: 30 };

function setup({ connection = CONNECTED, roasting = false, activeId = 3 } = {}) {
  const saveWiring = vi.fn(() => Promise.resolve(ok({ ...popper, ...request })));
  const read = vi.fn(() => Promise.resolve(ok([1, 2, 3, 4])));
  const reconnect = vi.fn(() => Promise.resolve(ok(undefined)));
  const calls = tc4WiringCalls({
    roasters: { saveWiring, active: () => ({ ...popper, id: activeId }) },
    inputs: { read },
    connection: () => connection,
    roasting: () => roasting,
    reconnect,
    logger: silentLogger,
  });
  return { calls, saveWiring, read, reconnect };
}

describe('tc4WiringCalls', () => {
  it('reconnects the connected roaster after saving its wiring', async () => {
    const { calls, saveWiring, reconnect } = setup();
    expect((await calls.saveWiring(request)).ok).toBe(true);
    expect(saveWiring).toHaveBeenCalledWith(request, false);
    expect(reconnect).toHaveBeenCalledOnce();
  });

  it('only saves when that roaster is not the connected one', async () => {
    const { calls, reconnect } = setup({ activeId: 1 });
    await calls.saveWiring(request);
    expect(reconnect).not.toHaveBeenCalled();
    const idle = setup({ connection: { status: 'disconnected' } });
    await idle.calls.saveWiring(request);
    expect(idle.reconnect).not.toHaveBeenCalled();
  });

  it('tells the service a roast is running, and never reconnects then', async () => {
    const { calls, saveWiring, reconnect } = setup({ roasting: true });
    saveWiring.mockResolvedValueOnce(err({ kind: 'roasting' }) as never);
    expect(await calls.saveWiring(request)).toEqual(err({ kind: 'roasting' }));
    expect(saveWiring).toHaveBeenCalledWith(request, true);
    expect(reconnect).not.toHaveBeenCalled();
  });

  it('says why the roaster did not come back after saving', async () => {
    const { calls, saveWiring, reconnect } = setup();
    reconnect.mockResolvedValueOnce(err({ kind: 'no-reply', command: 'READ' }) as never);
    expect(await calls.saveWiring(request)).toEqual(
      err({ kind: 'reconnect-failed', error: { kind: 'no-reply', command: 'READ' } }),
    );
    expect(saveWiring).toHaveBeenCalledOnce();
  });

  it('reconnects a roaster that is lost and retrying too, so the old wiring never comes back', async () => {
    const { calls, reconnect } = setup({
      connection: { status: 'lost', target: { kind: 'serial', path: 'COM3' } },
    });
    await calls.saveWiring(request);
    expect(reconnect).toHaveBeenCalledOnce();
  });

  it('never reconnects when a roast started while it saved', async () => {
    let roasting = false;
    const ctx = setup();
    ctx.saveWiring.mockImplementationOnce(() => {
      roasting = true;
      return Promise.resolve(ok({ ...popper, ...request }));
    });
    const calls = tc4WiringCalls({
      roasters: { saveWiring: ctx.saveWiring, active: () => popper },
      inputs: { read: ctx.read },
      connection: () => CONNECTED,
      roasting: () => roasting,
      reconnect: ctx.reconnect,
      logger: silentLogger,
    });
    expect((await calls.saveWiring(request)).ok).toBe(true);
    expect(ctx.reconnect).not.toHaveBeenCalled();
  });

  it('reads the inputs with whether a roast runs', async () => {
    const { calls, read } = setup({ roasting: true });
    await calls.readInputs();
    expect(read).toHaveBeenCalledWith({ connected: true, roasting: true });
  });
});
