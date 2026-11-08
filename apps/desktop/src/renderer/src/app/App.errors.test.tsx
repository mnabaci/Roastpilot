import { createLogger } from '@roastpilot/core';
import type { LogDay } from '@roastpilot/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTED, fakeApi, renderApp } from '../test/render-app';
import { App } from './App';

// Logs is the screen that fails to draw here: main answers with a day list it can't read.
const unreadableDays = {
  filter: () => {
    throw new Error('logs broke');
  },
} as unknown as LogDay[];
const brokenLogsApi = () => fakeApi({ listLogDays: vi.fn(() => Promise.resolve(unreadableDays)) });

const openLogs = async () => {
  const tabs = within(screen.getByRole('navigation', { name: 'Screens' }));
  await userEvent.click(tabs.getByRole('button', { name: 'Logs' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Logs hit a problem');
  return tabs;
};

describe('App when a screen fails to draw', () => {
  beforeEach(() => {
    // React reports caught render errors on console.error; keep the test output quiet.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it("shows that screen's error page, logs it, and keeps the top bar working", async () => {
    const write = vi.fn();
    renderApp(
      <App />,
      { connection: CONNECTED },
      brokenLogsApi(),
      createLogger({ write }, 'renderer'),
    );
    await openLogs();
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
    renderApp(<App />, { connection: CONNECTED }, brokenLogsApi());
    const tabs = await openLogs();
    await userEvent.click(tabs.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByText('Logs hit a problem')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });
});
