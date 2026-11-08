import { err, READY_ROAST } from '@roastpilot/shared';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { applySafetyEvent } from '../stores/safety-store';
import { CONNECTED, fakeApi, renderApp } from '../test/render-app';
import { SafetyBanners } from './SafetyBanners';

describe('SafetyBanners', () => {
  it('shows nothing when all is well', () => {
    const { container } = renderApp(<SafetyBanners />);
    expect(container).toBeEmptyDOMElement();
  });

  it('one banner per trip; the critical one carries Acknowledge', async () => {
    const { api } = renderApp(<SafetyBanners />, {
      safety: { locked: true, tripped: ['max-temperature', 'slow-rise'] },
    });
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('Too hot · heater off, fan and bean cooler on');
    expect(screen.getByRole('status')).toHaveTextContent('Temperature barely rising');
    expect(screen.queryByText(/Heater locked/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(api.acknowledgeSafety).toHaveBeenCalledOnce();
  });

  it('a separate Heater locked banner when the lock outlives every trip', () => {
    renderApp(<SafetyBanners />, { safety: { locked: true, tripped: [] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Heater locked');
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument();
  });

  it('says what is still tripped when Acknowledge is refused', async () => {
    const api = fakeApi({
      acknowledgeSafety: () =>
        Promise.resolve(err({ kind: 'still-tripped', rules: ['max-temperature'] })),
    });
    renderApp(<SafetyBanners />, { safety: { locked: true, tripped: ['max-temperature'] } }, api);
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(await screen.findByText('Still tripped: Too hot')).toBeInTheDocument();
  });

  it('drops the refusal once the trips change, so it never names a cleared rule', async () => {
    const api = fakeApi({
      acknowledgeSafety: () =>
        Promise.resolve(err({ kind: 'still-tripped', rules: ['max-temperature'] })),
    });
    const { stores } = renderApp(
      <SafetyBanners />,
      { safety: { locked: true, tripped: ['max-temperature'] } },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(await screen.findByText('Still tripped: Too hot')).toBeInTheDocument();
    act(() => {
      stores.safety.setState({ locked: true, tripped: [] });
    });
    expect(screen.queryByText(/Still tripped/)).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Heater locked');
  });

  it('an alarm alone has no Acknowledge', () => {
    renderApp(<SafetyBanners />, { safety: { locked: false, tripped: ['frozen-reading'] } });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  describe('the roaster unplugged', () => {
    const SIM = { kind: 'simulator' } as const;
    const lost = { status: 'lost', target: SIM } as const;
    const unplugged = { locked: true, tripped: ['lost-connection'] };

    it('idle: an amber warning that says what happens, with Disconnect and no Acknowledge', async () => {
      const { api } = renderApp(<SafetyBanners />, { safety: unplugged, connection: lost });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Roaster unplugged or not answering · heater off · trying to reconnect',
      );
      expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
      expect(screen.queryByText(/Heater locked/)).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      expect(api.disconnect).toHaveBeenCalledOnce();
    });

    it('mid-preheat: red, as the heater was on', () => {
      renderApp(<SafetyBanners />, {
        safety: unplugged,
        connection: lost,
        roast: { ...READY_ROAST, phase: 'preheat' },
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Roaster unplugged or not answering');
      expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    });

    it('offers no Acknowledge on another trip either, while it reconnects', () => {
      renderApp(<SafetyBanners />, {
        safety: { locked: true, tripped: ['max-temperature', 'lost-connection'] },
        connection: lost,
      });
      expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
    });

    it('readings back: the roaster is back, and Acknowledge lifts the lock', async () => {
      const { stores, api } = renderApp(<SafetyBanners />, {
        safety: unplugged,
        connection: lost,
      });
      act(() => {
        stores.connection.setState({ connection: CONNECTED });
        stores.safety.setState((s) =>
          applySafetyEvent(s, { kind: 'cleared', rule: 'lost-connection', atMs: 5 }),
        );
      });
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Roaster back · heater stays off until you acknowledge',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
      expect(api.acknowledgeSafety).toHaveBeenCalledOnce();
      act(() => {
        stores.safety.setState((s) => applySafetyEvent(s, { kind: 'unlocked', atMs: 6 }));
      });
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('after Disconnect: the lock outlives the trip, and Acknowledge works', () => {
      const { stores } = renderApp(<SafetyBanners />, { safety: unplugged, connection: lost });
      act(() => {
        stores.connection.setState({ connection: { status: 'disconnected' } });
        stores.safety.setState((s) =>
          applySafetyEvent(s, { kind: 'cleared', rule: 'lost-connection', atMs: 5 }),
        );
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Heater locked');
      expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument();
    });
  });
});
