import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_SETTINGS, err, SAFETY_NOTICE_VERSION, type Screen } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { CONNECTED, fakeApi, renderApp } from '../test/render-app';
import { App } from './App';

const FIRST_LAUNCH = { settings: DEFAULT_SETTINGS };
const accept = () =>
  userEvent.click(screen.getByRole('button', { name: 'I understand · continue' }));

/** The listener App gave to a main → renderer event, so a test can fire the app menu. */
function menuListener(subscribe: { mock: { calls: unknown[][] } }): (payload?: Screen) => void {
  const listener = subscribe.mock.calls.at(-1)?.[0];
  if (typeof listener !== 'function') throw new Error('App did not subscribe');
  return listener as (payload?: Screen) => void;
}

describe('App safety notice', () => {
  it('fills the window on first launch: no tabs, no screens', () => {
    renderApp(<App />, FIRST_LAUNCH);
    expect(
      screen.getByRole('heading', {
        name: 'Roastpilot switches a heater',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Screens' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I understand · continue' })).toHaveFocus();
  });

  it('waits for the settings before deciding', () => {
    renderApp(<App />, { ...FIRST_LAUNCH, ready: false });
    expect(
      screen.queryByRole('button', { name: 'I understand · continue' }),
    ).not.toBeInTheDocument();
  });

  it('accepting saves this version and opens the app', async () => {
    const { api } = renderApp(<App />, FIRST_LAUNCH);
    await accept();
    expect(api.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ safetyNoticeAccepted: SAFETY_NOTICE_VERSION }),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Roasters' })).toBeInTheDocument();
  });

  it('a failed save still opens the app, and says the notice comes back', async () => {
    const api = fakeApi({
      setSettings: () =>
        Promise.resolve(err({ kind: 'write-failed' as const, message: 'disk full' })),
    });
    renderApp(<App />, FIRST_LAUNCH, api);
    await accept();
    expect(screen.getByRole('heading', { level: 1, name: 'Roasters' })).toBeInTheDocument();
    expect(
      await screen.findByText("Couldn't save · the safety notice shows again next launch"),
    ).toBeInTheDocument();
  });

  it('shows again when the wording changes', () => {
    renderApp(<App />, {
      settings: { ...DEFAULT_SETTINGS, safetyNoticeAccepted: SAFETY_NOTICE_VERSION - 1 },
    });
    expect(screen.getByRole('button', { name: 'I understand · continue' })).toBeInTheDocument();
  });

  it('Help → Safety notice shows it under the top bar, with Emergency stop and Close', async () => {
    const { api } = renderApp(<App />, { connection: CONNECTED });
    act(() => {
      menuListener(api.onShowSafetyNotice)();
    });
    expect(screen.getByRole('heading', { name: /switches a heater/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emergency stop' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: /switches a heater/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preheat' })).toBeInTheDocument();
    expect(api.setSettings).not.toHaveBeenCalled();
  });

  it('a tab or the app menu leaves it', async () => {
    const { api } = renderApp(<App />, { connection: CONNECTED });
    const show = menuListener(api.onShowSafetyNotice);
    act(() => {
      show();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }));
    expect(screen.getByRole('heading', { name: 'Logs' })).toBeInTheDocument();
    act(() => {
      show();
      menuListener(api.onNavigate)('settings');
    });
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });
});
