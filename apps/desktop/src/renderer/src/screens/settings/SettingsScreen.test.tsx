import { err, type RoastpilotApi } from '@roastpilot/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONNECTED, fakeApi, renderApp } from '../../test/render-app';
import { SettingsScreen } from './SettingsScreen';

const ports = () =>
  Promise.resolve([{ path: '/dev/cu.usbserial-0001', manufacturer: 'Silicon Labs' }]);

describe('SettingsScreen', () => {
  it('lists the serial ports and the Simulator; Connect waits for a pick', async () => {
    renderApp(<SettingsScreen />, {}, fakeApi({ listPorts: ports }));
    expect(await screen.findByRole('button', { name: /usbserial-0001/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simulator/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  });

  it('picking a port saves it, and Connect connects to it', async () => {
    const { api } = renderApp(<SettingsScreen />, {}, fakeApi({ listPorts: ports }));
    await userEvent.click(await screen.findByRole('button', { name: /usbserial-0001/ }));
    expect(api.setSettings).toHaveBeenCalledWith({
      connection: { kind: 'serial', path: '/dev/cu.usbserial-0001' },
      controls: 'guided',
      chartSmoothingS: 5,
    });
    expect(screen.getByRole('button', { name: /usbserial-0001/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(api.connect).toHaveBeenCalledWith({ kind: 'serial', path: '/dev/cu.usbserial-0001' });
  });

  it('says why a connect failed, in one line', async () => {
    const api = fakeApi({
      connect: () => Promise.resolve(err({ kind: 'no-reply', command: 'VERSION' })),
    });
    renderApp(
      <SettingsScreen />,
      { settings: { connection: { kind: 'simulator' }, controls: 'guided', chartSmoothingS: 5 } },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No reply');
  });

  it('while connecting: a busy Connect button and a locked list, then the reason it failed', async () => {
    let finish: (value: Awaited<ReturnType<RoastpilotApi['connect']>>) => void = () => undefined;
    const api = fakeApi({
      connect: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    renderApp(
      <SettingsScreen />,
      { settings: { connection: { kind: 'simulator' }, controls: 'guided', chartSmoothingS: 5 } },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    const busy = screen.getByRole('button', { name: 'Connecting…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /Simulator/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    act(() => {
      finish(err({ kind: 'version-mismatch', expected: 1, actual: null }));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('No reply from the roaster');
    expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
  });

  it('shows Connecting… while main reports connecting', () => {
    renderApp(<SettingsScreen />, {
      connection: { status: 'connecting', target: { kind: 'simulator' } },
      settings: { connection: { kind: 'simulator' }, controls: 'guided', chartSmoothingS: 5 },
    });
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
  });

  it('says when there are no ports, and Refresh looks again', async () => {
    const listPorts = vi.fn(() => Promise.resolve([]));
    renderApp(<SettingsScreen />, {}, fakeApi({ listPorts }));
    expect(await screen.findByText(/No serial ports found/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(listPorts).toHaveBeenCalledTimes(2);
  });

  it('while connected: Disconnect, and the roaster list is locked', async () => {
    const { api } = renderApp(<SettingsScreen />, {
      connection: CONNECTED,
      settings: { connection: { kind: 'simulator' }, controls: 'guided', chartSmoothingS: 5 },
    });
    expect(screen.getByRole('button', { name: /Simulator/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(api.disconnect).toHaveBeenCalledOnce();
  });

  it('marks the roaster in use as Connected, even if another one was picked', async () => {
    renderApp(
      <SettingsScreen />,
      {
        connection: { status: 'connected', target: { kind: 'simulator' }, channels: [] },
        settings: { connection: null, controls: 'guided', chartSmoothingS: 5 },
      },
      fakeApi({ listPorts: ports }),
    );
    const simulator = screen.getByRole('button', { name: /Simulator/ });
    expect(simulator).toHaveAttribute('aria-pressed', 'true');
    expect(simulator).toHaveTextContent('Connected');
    expect(await screen.findByRole('button', { name: /usbserial-0001/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('switches between Guided and Full control', async () => {
    const { api, stores } = renderApp(<SettingsScreen />);
    expect(screen.getByRole('button', { name: 'Guided' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Full control' }));
    expect(stores.settings.getState().settings.controls).toBe('full');
    expect(api.setSettings).toHaveBeenCalledWith({
      connection: null,
      controls: 'full',
      chartSmoothingS: 5,
    });
  });

  it('picks how much the temperature line is smoothed', async () => {
    const { api, stores } = renderApp(<SettingsScreen />);
    const group = screen.getByRole('group', { name: 'Temperature smoothing' });
    expect(within(group).getByRole('button', { name: '5 s' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(within(group).getByRole('button', { name: 'Off' }));
    expect(stores.settings.getState().settings.chartSmoothingS).toBe(0);
    expect(api.setSettings).toHaveBeenCalledWith(expect.objectContaining({ chartSmoothingS: 0 }));
  });

  it('keeps the change for this session when saving fails', async () => {
    const api = fakeApi({
      setSettings: () => Promise.resolve(err({ kind: 'write-failed', message: 'disk full' })),
    });
    const { stores } = renderApp(<SettingsScreen />, {}, api);
    await userEvent.click(screen.getByRole('button', { name: 'Full control' }));
    expect(stores.settings.getState().settings.controls).toBe('full');
  });
});
