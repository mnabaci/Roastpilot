import { err, READY_ROAST, type UpdateStatus } from '@roastpilot/shared';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fakeApi, renderApp } from '../../test/render-app';
import { AboutSection } from './AboutSection';
import { clockTime } from './update-copy';

const ROASTING = { ...READY_ROAST, phase: 'roasting' as const, chargedAtMs: 0 };
const CHECKED_AT = '2026-11-07T14:02:00.000Z';

const toasts = (stores: ReturnType<typeof renderApp>['stores']) =>
  stores.toasts.getState().toasts.map((t) => t.text);

describe('AboutSection', () => {
  it('shows the version with What’s new, which opens the installed release notes', async () => {
    const { api } = renderApp(<AboutSection />, {
      version: '0.1.0',
      update: { state: 'idle', checkedAt: CHECKED_AT },
    });
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: "What's new" }));
    expect(api.openReleasePage).toHaveBeenCalledWith('installed');
  });

  it.each<[string, UpdateStatus, string, string | null]>([
    [
      'up to date',
      { state: 'idle', checkedAt: CHECKED_AT },
      `Up to date · checked ${clockTime(CHECKED_AT)}`,
      'Check for updates',
    ],
    ['not checked yet', { state: 'idle', checkedAt: null }, 'Not checked yet', 'Check for updates'],
    ['checking', { state: 'checking' }, 'Checking…', 'Check for updates'],
    [
      'downloading',
      { state: 'downloading', version: '0.2.0', percent: 45 },
      'Downloading 0.2.0 · 45 %',
      null,
    ],
    [
      'ready',
      { state: 'ready', version: '0.2.0' },
      '0.2.0 is ready · installs when you quit',
      'Restart to update',
    ],
    ['out on macOS', { state: 'available', version: '0.2.0' }, 'Version 0.2.0 is out', 'Download'],
    ["couldn't check", { state: 'failed' }, "Couldn't check · try again", 'Check for updates'],
    ['off in development', { state: 'off' }, 'Updates are off in development', null],
  ])('%s: one line and its one button', (_name, update, line, button) => {
    renderApp(<AboutSection />, { version: '0.1.0', update });
    expect(screen.getByText(line)).toBeInTheDocument();
    const buttons = screen
      .queryAllByRole('button')
      .map((b) => b.textContent)
      .filter((name) => name !== "What's new");
    expect(buttons).toEqual(button ? [button] : []);
  });

  it('before main has answered it shows dashes and no buttons', () => {
    renderApp(<AboutSection />);
    expect(screen.getAllByText('–')).toHaveLength(2);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('in development there is no What’s new: there is no release', () => {
    renderApp(<AboutSection />, { version: '0.0.0', update: { state: 'off' } });
    expect(screen.queryByRole('button', { name: "What's new" })).toBeNull();
  });

  it('Check for updates asks main; it is disabled while checking', async () => {
    const { api } = renderApp(<AboutSection />, {
      version: '0.1.0',
      update: { state: 'failed' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(api.checkForUpdates).toHaveBeenCalledTimes(1);
    renderApp(<AboutSection />, { version: '0.1.0', update: { state: 'checking' } });
    expect(screen.getAllByRole('button', { name: 'Check for updates' }).at(-1)).toBeDisabled();
  });

  it('a failed check is said in the line only, not in a toast', () => {
    const { stores } = renderApp(<AboutSection />, {
      version: '0.1.0',
      update: { state: 'failed' },
    });
    expect(screen.getByText("Couldn't check · try again")).toBeInTheDocument();
    expect(toasts(stores)).toEqual([]);
  });

  it('a check call that breaks shows a toast', async () => {
    const api = fakeApi({ checkForUpdates: vi.fn(() => Promise.reject(new Error('gone'))) });
    const { stores } = renderApp(
      <AboutSection />,
      { version: '0.1.0', update: { state: 'idle', checkedAt: null } },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    await vi.waitFor(() => {
      expect(toasts(stores)).toEqual(["Couldn't check · try again"]);
    });
  });

  it('Restart to update installs when no roast runs', async () => {
    const { api } = renderApp(<AboutSection />, {
      version: '0.1.0',
      update: { state: 'ready', version: '0.2.0' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Restart to update' }));
    expect(api.restartToUpdate).toHaveBeenCalledTimes(1);
  });

  it('mid-roast Restart to update is disabled: Finish the roast first', () => {
    const { api } = renderApp(<AboutSection />, {
      version: '0.1.0',
      update: { state: 'ready', version: '0.2.0' },
      roast: ROASTING,
    });
    expect(screen.getByRole('button', { name: 'Restart to update' })).toBeDisabled();
    expect(screen.getByText('Finish the roast first')).toBeInTheDocument();
    expect(api.restartToUpdate).not.toHaveBeenCalled();
  });

  it('drum cooling counts as a roast too', () => {
    renderApp(<AboutSection />, {
      version: '0.1.0',
      update: { state: 'ready', version: '0.2.0' },
      roast: { ...READY_ROAST, phase: 'done', roasterCoolingSinceMs: 1, roasterCoolToC: 50 },
    });
    expect(screen.getByRole('button', { name: 'Restart to update' })).toBeDisabled();
  });

  it('a roast that started after the button showed: main refuses and a toast says why', async () => {
    const api = fakeApi({
      restartToUpdate: vi.fn(() => Promise.resolve(err({ kind: 'roasting' as const }))),
    });
    const { stores } = renderApp(
      <AboutSection />,
      { version: '0.1.0', update: { state: 'ready', version: '0.2.0' } },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Restart to update' }));
    await vi.waitFor(() => {
      expect(toasts(stores)).toEqual(['Finish the roast first']);
    });
  });

  it('an installer that will not start: a toast, and the button stays', async () => {
    const api = fakeApi({
      restartToUpdate: vi.fn(() => Promise.resolve(err({ kind: 'install-failed' as const }))),
    });
    const { stores } = renderApp(
      <AboutSection />,
      { version: '0.1.0', update: { state: 'ready', version: '0.2.0' } },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Restart to update' }));
    await vi.waitFor(() => {
      expect(toasts(stores)).toEqual(["Couldn't start the update · try again"]);
    });
    expect(screen.getByRole('button', { name: 'Restart to update' })).toBeEnabled();
  });

  it('Download opens the page of the version that is out', async () => {
    const { api } = renderApp(<AboutSection />, {
      version: '0.1.0',
      update: { state: 'available', version: '0.2.0' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(api.openReleasePage).toHaveBeenCalledWith('latest');
  });

  it('a release page that will not open shows a toast', async () => {
    const api = fakeApi({
      openReleasePage: vi.fn(() => Promise.resolve(err({ kind: 'open-failed' as const }))),
    });
    const { stores } = renderApp(
      <AboutSection />,
      { version: '0.1.0', update: { state: 'available', version: '0.2.0' } },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    await vi.waitFor(() => {
      expect(toasts(stores)).toEqual(["Couldn't open the release page · try again"]);
    });
  });

  it('follows the status as main sends it', () => {
    const { stores } = renderApp(<AboutSection />, {
      version: '0.1.0',
      update: { state: 'checking' },
    });
    expect(screen.getByText('Checking…')).toBeInTheDocument();
    act(() => {
      stores.updates.setState({ status: { state: 'downloading', version: '0.2.0', percent: 10 } });
    });
    expect(screen.getByText('Downloading 0.2.0 · 10 %')).toBeInTheDocument();
  });
});
