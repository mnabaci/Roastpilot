import { DEFAULT_TC4_WIRING, err, READY_ROAST } from '@roastpilot/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONNECTED, fakeApi, renderApp } from '../../test/render-app';
import { POPPER, SKYWALKER } from '../../test/roasters';
import { RoastersScreen } from './RoastersScreen';

import { card, openWiring, roasters, withInputs } from './wiring-card-fixture';

describe('WiringCard', () => {
  it('shows only on a roaster with wiring', () => {
    renderApp(<RoastersScreen />, { roasters: [SKYWALKER] });
    expect(screen.queryByRole('region', { name: 'Wiring' })).toBeNull();
  });

  it('folds to its summary once the roaster has a port, and reads no inputs while folded', () => {
    const api = withInputs();
    renderApp(<RoastersScreen />, { connection: CONNECTED, roasters }, api);
    const header = screen.getByRole('button', { name: 'Wiring' });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(header).toHaveAccessibleDescription('BT TC2 · ET TC1 · Heater OT1 · Fan OT2 · 115,200');
    expect(api.readRoasterInputs).not.toHaveBeenCalled();
  });

  it('is open on a roaster with no port yet, as it is being wired up', () => {
    renderApp(<RoastersScreen />, {
      roasters: [
        { ...SKYWALKER, active: false },
        { ...POPPER, connection: null },
      ],
    });
    expect(screen.getByRole('button', { name: 'Wiring' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('saves a pick at once, even while connected, and says it reconnects', async () => {
    const api = withInputs();
    renderApp(<RoastersScreen />, { connection: CONNECTED, roasters }, api);
    await openWiring();
    expect(card().getByText('Saves as you pick · reconnects the roaster')).toBeInTheDocument();
    await userEvent.click(card().getByRole('radio', { name: 'IO3 · DC fan' }));
    expect(api.saveRoasterWiring).toHaveBeenCalledWith({
      id: POPPER.id,
      wiring: { ...DEFAULT_TC4_WIRING, fanOutput: 'IO3' },
      minFanHeatingPct: 0,
    });
  });

  it('has no live readings while disconnected', async () => {
    renderApp(<RoastersScreen />, { roasters }, withInputs());
    await openWiring();
    expect(screen.queryByRole('list', { name: 'Inputs now' })).toBeNull();
    expect(card().getByText('Saves as you pick')).toBeInTheDocument();
  });

  it('waits while a roast runs: no readings, nothing to change', async () => {
    renderApp(
      <RoastersScreen />,
      { connection: CONNECTED, roasters, roast: { ...READY_ROAST, phase: 'roasting' } },
      withInputs(),
    );
    await openWiring();
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
    await openWiring();
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
    await openWiring();
    expect(card().getByText("Waits until Simulator's roast ends")).toBeInTheDocument();
  });

  it('says when main refused the save', async () => {
    const api = fakeApi();
    renderApp(<RoastersScreen />, { roasters }, api);
    await openWiring();
    await act(async () => {
      await userEvent.click(card().getByRole('radio', { name: 'IO3' }));
    });
    expect(await card().findByRole('alert')).toHaveTextContent('Waits until the roast ends');
  });
});
