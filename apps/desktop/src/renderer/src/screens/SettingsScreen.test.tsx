import { err } from '@roastpilot/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONNECTED, fakeApi, renderApp } from '../test/render-app';
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
      { settings: { connection: { kind: 'simulator' }, controls: 'guided' } },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No reply');
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
      settings: { connection: { kind: 'simulator' }, controls: 'guided' },
    });
    expect(screen.getByRole('button', { name: /Simulator/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(api.disconnect).toHaveBeenCalledOnce();
  });

  it('switches between Guided and Full control', async () => {
    const { api, store } = renderApp(<SettingsScreen />);
    expect(screen.getByRole('button', { name: 'Guided' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Full control' }));
    expect(store.getState().settings.controls).toBe('full');
    expect(api.setSettings).toHaveBeenCalledWith({ connection: null, controls: 'full' });
  });

  it('keeps the change for this session when saving fails', async () => {
    const api = fakeApi({
      setSettings: () => Promise.resolve(err({ kind: 'write-failed', message: 'disk full' })),
    });
    const { store } = renderApp(<SettingsScreen />, {}, api);
    await userEvent.click(screen.getByRole('button', { name: 'Full control' }));
    expect(store.getState().settings.controls).toBe('full');
  });
});
