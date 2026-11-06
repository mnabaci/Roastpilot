import { err, type RoastpilotApi, DEFAULT_SETTINGS } from '@roastpilot/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONNECTED, fakeApi, renderApp } from '../../test/render-app';
import { roastersWith } from '../../test/roasters';
import { SettingsScreen } from './SettingsScreen';

const ports = () =>
  Promise.resolve([{ path: '/dev/cu.usbserial-0001', manufacturer: 'Silicon Labs' }]);

describe('SettingsScreen', () => {
  it('lists the serial ports and the Simulator; Connect waits for a pick', async () => {
    renderApp(<SettingsScreen />, {}, fakeApi({ listPorts: ports }));
    expect(await screen.findByRole('button', { name: /usbserial-0001/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Simulator/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  });

  it('picking a port saves it, and Connect connects to it', async () => {
    const port = { kind: 'serial', path: '/dev/cu.usbserial-0001' } as const;
    const api = fakeApi({
      listPorts: ports,
      listRoasters: vi.fn(() => Promise.resolve(roastersWith(port))),
    });
    renderApp(<SettingsScreen />, { roasters: roastersWith(null) }, api);
    await userEvent.click(await screen.findByRole('button', { name: /usbserial-0001/ }));
    expect(api.chooseConnection).toHaveBeenCalledWith(port);
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /usbserial-0001/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(api.connect).toHaveBeenCalledWith({ kind: 'serial', path: '/dev/cu.usbserial-0001' });
  });

  it('says why a connect failed, in one line', async () => {
    const api = fakeApi({
      connect: () => Promise.resolve(err({ kind: 'no-reply', command: 'VERSION' })),
    });
    renderApp(
      <SettingsScreen />,
      {
        roasters: roastersWith({ kind: 'simulator' }),
        settings: { ...DEFAULT_SETTINGS, chartSmoothingS: 5 },
      },
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
      {
        roasters: roastersWith({ kind: 'simulator' }),
        settings: { ...DEFAULT_SETTINGS, chartSmoothingS: 5 },
      },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    const busy = screen.getByRole('button', { name: 'Connecting…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /^Simulator/ })).toBeDisabled();
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
      roasters: roastersWith({ kind: 'simulator' }),
      settings: { ...DEFAULT_SETTINGS, chartSmoothingS: 5 },
    });
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
  });

  it('says when there are no ports, and Refresh looks again', async () => {
    const listPorts = vi.fn(() => Promise.resolve([]));
    renderApp(<SettingsScreen />, {}, fakeApi({ listPorts }));
    expect(await screen.findByText(/No roaster found/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(listPorts).toHaveBeenCalledTimes(2);
  });

  it('while connected: the port in use, locked, and Disconnect', async () => {
    const { api } = renderApp(<SettingsScreen />, {
      connection: CONNECTED,
      roasters: roastersWith({ kind: 'simulator' }),
      settings: { ...DEFAULT_SETTINGS, chartSmoothingS: 5 },
    });
    expect(screen.getByRole('button', { name: /usbserial-0001/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Simulator/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(api.disconnect).toHaveBeenCalledOnce();
  });

  it('while connected, shows only the roaster in use, marked Connected', async () => {
    renderApp(
      <SettingsScreen />,
      {
        connection: { status: 'connected', target: { kind: 'simulator' }, channels: [] },
        roasters: roastersWith(null),
        settings: { ...DEFAULT_SETTINGS, chartSmoothingS: 5 },
      },
      fakeApi({ listPorts: ports }),
    );
    const simulator = screen.getByRole('button', { name: /^Simulator/ });
    expect(simulator).toHaveAttribute('aria-pressed', 'true');
    expect(simulator).toHaveTextContent('Connected');
    // Only the roaster in use shows, and there is nothing to refresh.
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: /usbserial-0001/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  });

  it('shows the remembered roaster alone; Choose another opens likely roasters, then all ports', async () => {
    const listPorts = () =>
      Promise.resolve([
        { path: '/dev/cu.debug-console' },
        { path: '/dev/cu.usbserial-0001', manufacturer: 'Silicon Labs' },
      ]);
    const { api } = renderApp(
      <SettingsScreen />,
      {
        roasters: roastersWith({ kind: 'serial', path: '/dev/cu.usbserial-0001' }),
        settings: { ...DEFAULT_SETTINGS, chartSmoothingS: 5 },
      },
      fakeApi({
        listPorts,
        listRoasters: vi.fn(() => Promise.resolve(roastersWith({ kind: 'simulator' }))),
      }),
    );
    const list = screen.getByRole('list', { name: 'Roasters' });
    expect(await within(list).findByText('Silicon Labs')).toBeInTheDocument();
    expect(within(list).getAllByRole('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Choose another' }));
    expect(within(list).getAllByRole('button')).toHaveLength(2);
    expect(within(list).queryByText(/debug-console/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show all ports (1 more)' }));
    expect(within(list).getByText(/debug-console/)).toBeInTheDocument();
    await userEvent.click(within(list).getByRole('button', { name: /^Simulator/ }));
    expect(api.chooseConnection).toHaveBeenCalledWith({ kind: 'simulator' });
    await vi.waitFor(() => {
      expect(within(list).getAllByRole('button')).toHaveLength(1);
    });
  });

  it('roast settings: charge point, cooling time and roaster cool-down', async () => {
    const { api, stores } = renderApp(<SettingsScreen />);
    const group = (name: string) => within(screen.getByRole('group', { name }));
    expect(group('Find the charge point').getByRole('button', { name: 'On' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(group('Cooling time').getByRole('button', { name: '4 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(group('Find the charge point').getByRole('button', { name: 'Off' }));
    await userEvent.click(group('Cooling time').getByRole('button', { name: '6 min' }));
    await userEvent.click(
      group('Cool the roaster after each roast').getByRole('button', { name: 'Off' }),
    );
    expect(stores.settings.getState().settings).toMatchObject({
      findChargePoint: false,
      coolingTimeMin: 6,
      coolRoasterAfter: false,
    });
    expect(api.setSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        findChargePoint: false,
        coolingTimeMin: 6,
        coolRoasterAfter: false,
      }),
    );
  });

  it('cooling ends by time or by temperature; the roaster cools to its own target', async () => {
    const { api, stores } = renderApp(<SettingsScreen />);
    const group = (name: string) => within(screen.getByRole('group', { name }));
    expect(screen.queryByRole('group', { name: 'Cool until below' })).not.toBeInTheDocument();
    await userEvent.click(group('Cooling ends').getByRole('button', { name: 'By temperature' }));
    expect(screen.queryByRole('group', { name: 'Cooling time' })).not.toBeInTheDocument();
    expect(group('Cool until below').getByRole('button', { name: '90 °C' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(group('Cool until below').getByRole('button', { name: '80 °C' }));
    await userEvent.click(group('Cool the roaster to').getByRole('button', { name: '60 °C' }));
    expect(stores.settings.getState().settings).toMatchObject({
      coolingEnd: 'temperature',
      coolingBelowC: 80,
      roasterCoolToC: 60,
    });
    expect(api.setSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ coolingEnd: 'temperature', coolingBelowC: 80, roasterCoolToC: 60 }),
    );
  });

  it('switches between Guided and Full control', async () => {
    const { api, stores } = renderApp(<SettingsScreen />);
    expect(screen.getByRole('button', { name: 'Guided' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Full control' }));
    expect(stores.settings.getState().settings.controls).toBe('full');
    expect(api.setSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      connection: null,
      controls: 'full',
      chartSmoothingS: 3,
    });
  });

  it('picks how much the temperature line is smoothed', async () => {
    const { api, stores } = renderApp(<SettingsScreen />);
    const group = screen.getByRole('group', { name: 'Temperature smoothing' });
    expect(within(group).getByRole('button', { name: '3 s' })).toHaveAttribute(
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

  describe('Roasters', () => {
    const roasters = roastersWith(null);
    const open = (seed = {}, api = fakeApi()) =>
      renderApp(<SettingsScreen />, { roasters, ...seed }, api);

    it('lists the records, marks the active one, and switches', async () => {
      const { api } = open();
      const list = screen.getByRole('list', { name: 'Roaster records' });
      expect(within(list).getByText('Active')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Use Simulator' }));
      expect(api.setActiveRoaster).toHaveBeenCalledWith(2);
    });

    it('saves an edit, and holds Save back while a cell has a problem', async () => {
      const { api } = open();
      await userEvent.click(screen.getByRole('button', { name: 'Edit Skywalker' }));
      const maxTemp = screen.getByRole('textbox', { name: 'Max temp' });
      await userEvent.clear(maxTemp);
      await userEvent.type(maxTemp, '300');
      expect(screen.getByText('At most 240 °C on this model')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      await userEvent.clear(maxTemp);
      await userEvent.type(maxTemp, '230');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(api.saveRoaster).toHaveBeenCalledWith(expect.objectContaining({ maxTempC: 230 }));
    });

    it('locks everything while connected', async () => {
      open({ connection: CONNECTED });
      expect(screen.getByText('Disconnect to change roasters')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Use Simulator' })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Edit Skywalker' }));
      expect(screen.getByRole('textbox', { name: 'Max temp' })).toBeDisabled();
    });

    it('adds a roaster', async () => {
      const { api } = open();
      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
      await userEvent.type(screen.getByRole('textbox', { name: 'New roaster' }), 'Second');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      expect(api.addRoaster).toHaveBeenCalledWith({ name: 'Second', model: 'skywalker' });
    });

    it('says why a roaster with roasts stays', async () => {
      const api = fakeApi({
        deleteRoaster: vi.fn(() =>
          Promise.resolve(err({ kind: 'has-roasts' as const, roasts: 2, profiles: 0 })),
        ),
      });
      open({}, api);
      await userEvent.click(screen.getByRole('button', { name: 'Edit Simulator' }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('saved roasts or profiles');
    });
  });
});
