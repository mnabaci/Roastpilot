import { err } from '@roastpilot/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { fakeApi, renderApp } from '../test/render-app';
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

  it('an alarm alone has no Acknowledge', () => {
    renderApp(<SafetyBanners />, { safety: { locked: false, tripped: ['frozen-reading'] } });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
