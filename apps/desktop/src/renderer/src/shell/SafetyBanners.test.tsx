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

  it('a banner per tripped rule, and the lock with Acknowledge', async () => {
    const { api } = renderApp(<SafetyBanners />, {
      safety: { locked: true, tripped: ['max-temperature', 'slow-rise'] },
    });
    expect(screen.getByText('Too hot · heater off, cooling on')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Temperature barely rising');
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(api.acknowledgeSafety).toHaveBeenCalledOnce();
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
