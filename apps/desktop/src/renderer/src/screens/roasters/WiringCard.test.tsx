import { DEFAULT_TC4_WIRING, err, ok, READY_ROAST } from '@roastpilot/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { silentLogger } from '@roastpilot/core';
import { CONNECTED, fakeApi, renderApp } from '../../test/render-app';
import { POPPER, SKYWALKER } from '../../test/roasters';
import { RoastersScreen } from './RoastersScreen';

const roasters = [{ ...SKYWALKER, active: false }, POPPER];
const card = () => within(screen.getByRole('region', { name: 'Wiring' }));

function withInputs() {
  return fakeApi({
    readRoasterInputs: vi.fn(() => Promise.resolve(ok([212.4, 165.2, 21.9, 22.1]))),
    saveRoasterWiring: vi.fn((request) => Promise.resolve(ok({ ...POPPER, ...request }))),
  });
}

describe('WiringCard', () => {
  it('shows only on a roaster with wiring', () => {
    renderApp(<RoastersScreen />, { roasters: [SKYWALKER] });
    expect(screen.queryByRole('region', { name: 'Wiring' })).toBeNull();
  });

  it('saves a pick at once, even while connected, and says it reconnects', async () => {
    const api = withInputs();
    renderApp(<RoastersScreen />, { connection: CONNECTED, roasters }, api);
    expect(card().getByText('Saves as you pick · reconnects the roaster')).toBeInTheDocument();
    await userEvent.click(card().getByRole('radio', { name: 'IO3 · DC fan' }));
    expect(api.saveRoasterWiring).toHaveBeenCalledWith({
      id: POPPER.id,
      wiring: { ...DEFAULT_TC4_WIRING, fanOutput: 'IO3' },
      minFanHeatingPct: 0,
    });
  });

  it('shows TC1–TC4 live while connected, with BT and ET under theirs', async () => {
    renderApp(<RoastersScreen />, { connection: CONNECTED, roasters }, withInputs());
    const inputs = within(await screen.findByRole('list', { name: 'Inputs now' }));
    expect(await inputs.findByText('165.2')).toBeInTheDocument();
    const tiles = inputs.getAllByRole('listitem').map((tile) => tile.textContent);
    expect(tiles).toEqual(['TC1212.4°CET', 'TC2165.2°CBT', 'TC321.9°C\u00a0', 'TC422.1°C\u00a0']);
  });

  it('reads one at a time, never stacking calls, and logs a failing board once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let pending = 0;
      let most = 0;
      const api = fakeApi({
        readRoasterInputs: vi.fn(async () => {
          pending++;
          most = Math.max(most, pending);
          // Slower than the 2 s between reads.
          await new Promise((resolve) => setTimeout(resolve, 3000));
          pending--;
          return err({ kind: 'no-reply' as const, command: 'READ' });
        }),
      });
      const warn = vi.fn();
      renderApp(<RoastersScreen />, { connection: CONNECTED, roasters }, api, {
        ...silentLogger,
        warn,
        child: () => ({ ...silentLogger, warn }),
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(16_000);
      });
      expect(most).toBe(1);
      expect(vi.mocked(api.readRoasterInputs).mock.calls.length).toBeGreaterThan(2);
      expect(warn.mock.calls.filter(([event]) => event === 'roasters.inputs-failed')).toHaveLength(
        1,
      );
      expect(card().getByText("Couldn't read the inputs · check the board")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('has no live readings while disconnected', () => {
    renderApp(<RoastersScreen />, { roasters }, withInputs());
    expect(screen.queryByRole('list', { name: 'Inputs now' })).toBeNull();
    expect(card().getByText('Saves as you pick')).toBeInTheDocument();
  });

  it('waits while a roast runs: no readings, nothing to change', () => {
    renderApp(
      <RoastersScreen />,
      { connection: CONNECTED, roasters, roast: { ...READY_ROAST, phase: 'roasting' } },
      withInputs(),
    );
    expect(card().getByText('Waits until the roast ends')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Inputs now' })).toBeNull();
    expect(card().getByRole('radiogroup', { name: 'Heater output' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('says it saved but the roaster did not come back, and why', async () => {
    const api = fakeApi({
      saveRoasterWiring: vi.fn(() =>
        Promise.resolve(
          err({
            kind: 'reconnect-failed' as const,
            error: { kind: 'no-reply' as const, command: 'CHAN;1200' },
          }),
        ),
      ),
    });
    renderApp(<RoastersScreen />, { connection: CONNECTED, roasters }, api);
    await act(async () => {
      await userEvent.click(card().getByRole('radio', { name: 'IO3' }));
    });
    expect(await card().findByRole('alert')).toHaveTextContent(
      'Saved · No reply · check the baud, and that aArtisanQ_PID is flashed',
    );
  });

  it("names the other roaster when it is that one's roast the wiring waits for", async () => {
    const simulatorActive = [
      { ...SKYWALKER, name: 'Simulator', active: true },
      { ...POPPER, active: false },
    ];
    renderApp(
      <RoastersScreen />,
      {
        connection: CONNECTED,
        roasters: simulatorActive,
        roast: { ...READY_ROAST, phase: 'roasting' },
      },
      withInputs(),
    );
    await userEvent.click(
      within(screen.getByRole('list', { name: 'Roasters' })).getByRole('button', {
        name: /Popper/,
      }),
    );
    expect(card().getByText("Waits until Simulator's roast ends")).toBeInTheDocument();
  });

  it('says when main refused the save', async () => {
    const api = fakeApi();
    renderApp(<RoastersScreen />, { roasters }, api);
    await act(async () => {
      await userEvent.click(card().getByRole('radio', { name: 'IO3' }));
    });
    expect(await card().findByRole('alert')).toHaveTextContent('Waits until the roast ends');
  });
});
