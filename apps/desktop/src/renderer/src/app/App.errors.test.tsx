import { createLogger } from '@roastpilot/core';
import type * as Ui from '@roastpilot/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createStores } from '../stores/stores';
import { CONNECTED, fakeApi, renderApp } from '../test/render-app';
import { App } from './App';
import { AppProvider } from './AppProvider';

vi.mock('@roastpilot/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  RoastChart: (await import('../test/fake-ui')).FakeRoastChart,
}));

// Logs is the screen that fails to draw here; every other screen is real.
vi.mock('../screens/logs/LogsScreen', () => ({
  LogsScreen: () => {
    throw new Error('logs broke');
  },
}));

describe('App when a screen fails to draw', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  it("shows that screen's error page, logs it, and keeps the top bar working", async () => {
    const write = vi.fn();
    const stores = createStores({ ready: true, connection: CONNECTED });
    render(
      <AppProvider deps={{ api: fakeApi(), stores, logger: createLogger({ write }, 'renderer') }}>
        <App />
      </AppProvider>,
    );
    const tabs = within(screen.getByRole('navigation', { name: 'Screens' }));
    await userEvent.click(tabs.getByRole('button', { name: 'Logs' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Logs hit a problem');
    expect(screen.getByText('logs broke')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emergency stop' })).toBeEnabled();
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        event: 'renderer.screen-failed',
        context: expect.objectContaining({ screen: 'logs' }) as unknown,
      }),
    );
  });

  it('opening another screen leaves the error page', async () => {
    renderApp(<App />, { connection: CONNECTED });
    const tabs = within(screen.getByRole('navigation', { name: 'Screens' }));
    await userEvent.click(tabs.getByRole('button', { name: 'Logs' }));
    await userEvent.click(tabs.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByText('Logs hit a problem')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });
});
