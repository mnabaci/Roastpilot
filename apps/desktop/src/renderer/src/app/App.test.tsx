import { act, screen, within } from '@testing-library/react';
import type * as Ui from '@roastpilot/ui';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { READY_ROAST, type Screen } from '@roastpilot/shared';
import { CONNECTED, fakeApi, renderApp } from '../test/render-app';
import { App } from './App';

vi.mock('@roastpilot/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  RoastChart: (await import('../test/fake-ui')).FakeRoastChart,
}));

const SIM = { kind: 'simulator' } as const;

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

  it('Emergency stop is on every screen, and disabled with no roaster', async () => {
    const { api, stores } = renderApp(<App />);
    expect(screen.getByRole('button', { name: 'Emergency stop' })).toBeDisabled();
    act(() => {
      stores.connection.setState({ connection: CONNECTED });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Emergency stop' }));
    expect(api.emergencyStop).toHaveBeenCalledOnce();
  });

  it.each([
    { status: 'connecting', target: SIM } as const,
    { status: 'lost', target: SIM } as const,
  ])('Emergency stop stays live while %o', (connection) => {
    renderApp(<App />, { connection });
    expect(screen.getByRole('button', { name: 'Emergency stop' })).toBeEnabled();
  });

  it('stays on Settings while connecting, then opens Roast once connected', () => {
    const { stores } = renderApp(<App />);
    act(() => {
      stores.connection.setState({ connection: { status: 'connecting', target: SIM } });
    });
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    act(() => {
      stores.connection.setState({ connection: CONNECTED });
    });
    expect(screen.getByRole('button', { name: 'Preheat' })).toBeInTheDocument();
  });

  it('names the roaster it is connected to', () => {
    renderApp(<App />, { connection: CONNECTED });
    expect(screen.getByText('usbserial-0001')).toBeInTheDocument();
  });

  it('shows the connection status', () => {
    renderApp(<App />, { connection: { status: 'lost', target: SIM } });
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

  it('shows the mark and the name in the top bar', () => {
    renderApp(<App />, { connection: CONNECTED });
    expect(within(screen.getByRole('banner')).getByText('Roastpilot')).toBeInTheDocument();
  });

  it('off the Roast screen during a roast, the strip shows it and opens Roast', async () => {
    renderApp(<App />, {
      connection: CONNECTED,
      roast: { ...READY_ROAST, phase: 'roasting', chargedAtMs: 0 },
      readings: [{ atMs: 60_000, values: { bt: 150 } }],
    });
    expect(screen.queryByRole('button', { name: /Roasting · 1:00/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    await userEvent.click(screen.getByRole('button', { name: /Roasting · 1:00/ }));
    expect(screen.getByRole('button', { name: 'Roast' })).toHaveAttribute('aria-current', 'page');
  });

  it('no strip when no roast is running', async () => {
    renderApp(<App />, { connection: CONNECTED, readings: [{ atMs: 0, values: { bt: 22 } }] });
    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.queryByRole('button', { name: /Ready ·/ })).not.toBeInTheDocument();
  });

  it('the app menu opens a screen (Settings… ⌘,)', () => {
    let navigate: (screen: Screen) => void = () => undefined;
    const api = fakeApi({
      onNavigate: vi.fn((listener: (screen: Screen) => void) => {
        navigate = listener;
        return () => undefined;
      }),
    });
    renderApp(<App />, { connection: CONNECTED }, api);
    expect(screen.getByRole('button', { name: 'Preheat' })).toBeInTheDocument();
    act(() => {
      navigate('settings');
    });
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });
});
