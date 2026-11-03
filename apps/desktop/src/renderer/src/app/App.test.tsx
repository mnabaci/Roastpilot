import { screen } from '@testing-library/react';
import type * as Ui from '@roastpilot/ui';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONNECTED, renderApp } from '../test/render-app';
import { App } from './App';

vi.mock('@roastpilot/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  RoastChart: (await import('../test/fake-ui')).FakeRoastChart,
}));

describe('App', () => {
  it('opens on Settings until a roaster is connected', () => {
    renderApp(<App />);
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens on the Roast screen when connected, and navigates', async () => {
    renderApp(<App />, { connection: CONNECTED });
    expect(screen.getByRole('button', { name: 'Preheat' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('Emergency stop is on every screen, even disconnected', async () => {
    const { api } = renderApp(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Emergency stop' }));
    expect(api.emergencyStop).toHaveBeenCalledOnce();
  });

  it('shows the connection status', () => {
    renderApp(<App />, { connection: { status: 'lost' } });
    expect(screen.getByText('Connection lost')).toBeInTheDocument();
  });

  it('shows nothing but the bar until the first snapshot', () => {
    renderApp(<App />, { ready: false });
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emergency stop' })).toBeInTheDocument();
  });

  it('the Logs tab opens the log viewer', async () => {
    renderApp(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    expect(screen.getByRole('heading', { name: 'Logs' })).toBeInTheDocument();
  });
});
