import { err, ok, type RoastpilotApi } from '@roastpilot/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CONNECTED, fakeApi, renderApp } from '../../test/render-app';
import { roastersWith, SIMULATOR, SKYWALKER } from '../../test/roasters';
import { RoastersScreen } from './RoastersScreen';

const PORT = { kind: 'serial', path: '/dev/cu.usbserial-0001' } as const;
const ports = () =>
  Promise.resolve([{ path: '/dev/cu.usbserial-0001', manufacturer: 'Silicon Labs' }]);

const sidebar = () => within(screen.getByRole('list', { name: 'Roasters' }));

describe('RoastersScreen', () => {
  describe('the list', () => {
    it('lists the records, marks the active one, and opens it', () => {
      renderApp(<RoastersScreen />, { roasters: roastersWith(null) });
      const open = sidebar().getByRole('button', { name: /Skywalker/ });
      expect(open).toHaveAttribute('aria-current', 'true');
      expect(within(open).getByText('Active')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Skywalker' })).toBeInTheDocument();
    });

    it('opens another roaster without making it active', async () => {
      const { api } = renderApp(<RoastersScreen />, { roasters: roastersWith(null) });
      await userEvent.click(sidebar().getByRole('button', { name: /^Simulator/ }));
      expect(screen.getByRole('heading', { level: 2, name: 'Simulator' })).toBeInTheDocument();
      expect(api.setActiveRoaster).not.toHaveBeenCalled();
    });

    it('says why a roaster could not be added', async () => {
      // The default fake refuses an add as if a roaster were in use.
      renderApp(<RoastersScreen />, { roasters: roastersWith(null) });
      await userEvent.click(screen.getByRole('button', { name: 'Add roaster' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Second');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Disconnect first');
    });

    it('Use this roaster makes it active without connecting', async () => {
      const { api } = renderApp(<RoastersScreen />, { roasters: roastersWith(null) });
      // The active roaster has nothing to switch to, so no ⋯ at all.
      expect(screen.queryByRole('button', { name: /^More for / })).toBeNull();
      await userEvent.click(sidebar().getByRole('button', { name: /^Simulator/ }));
      await userEvent.click(screen.getByRole('button', { name: 'More for Simulator' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Use this roaster' }));
      expect(api.setActiveRoaster).toHaveBeenCalledWith(SIMULATOR.id);
      expect(api.connect).not.toHaveBeenCalled();
    });

    it("says why a roaster can't be made active", async () => {
      const api = fakeApi({
        setActiveRoaster: vi.fn(() =>
          Promise.resolve(err({ kind: 'storage-failed' as const, message: 'locked' })),
        ),
      });
      renderApp(<RoastersScreen />, { roasters: roastersWith(null) }, api);
      await userEvent.click(sidebar().getByRole('button', { name: /^Simulator/ }));
      await userEvent.click(screen.getByRole('button', { name: 'More for Simulator' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Use this roaster' }));
      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't switch roasters");
    });

    it('offers no switch while a roaster is in use', async () => {
      renderApp(<RoastersScreen />, { connection: CONNECTED, roasters: roastersWith(PORT) });
      await userEvent.click(sidebar().getByRole('button', { name: /^Simulator/ }));
      expect(screen.queryByRole('button', { name: 'More for Simulator' })).toBeNull();
    });

    it('adds a roaster, then opens it', async () => {
      const api = fakeApi({
        addRoaster: vi.fn(() => Promise.resolve(ok({ ...SIMULATOR, id: 3, name: 'Second' }))),
      });
      renderApp(<RoastersScreen />, { roasters: roastersWith(null) }, api);
      await userEvent.click(screen.getByRole('button', { name: 'Add roaster' }));
      const add = screen.getByRole('button', { name: 'Add' });
      expect(add).toBeDisabled();
      await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Second');
      await userEvent.click(add);
      expect(api.addRoaster).toHaveBeenCalledWith({ name: 'Second', model: 'skywalker' });
      expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    });
  });

  describe('connecting a Skywalker', () => {
    it('lists the serial ports, not the Simulator; Connect waits for a pick', async () => {
      renderApp(
        <RoastersScreen />,
        { roasters: roastersWith(null) },
        fakeApi({ listPorts: ports }),
      );
      const list = within(screen.getByRole('list', { name: 'Ports' }));
      expect(await list.findByRole('button', { name: /usbserial-0001/ })).toBeInTheDocument();
      expect(list.queryByRole('button', { name: /Simulator/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
      expect(screen.getByText('Pick a port to connect')).toBeInTheDocument();
    });

    it('picking a port saves it, and Connect connects to it', async () => {
      const api = fakeApi({
        listPorts: ports,
        listRoasters: vi.fn(() => Promise.resolve(roastersWith(PORT))),
      });
      const { stores } = renderApp(<RoastersScreen />, { roasters: roastersWith(null) }, api);
      await userEvent.click(await screen.findByRole('button', { name: /usbserial-0001/ }));
      expect(api.chooseConnection).toHaveBeenCalledWith(PORT);
      await vi.waitFor(() => {
        expect(stores.roasters.getState().roasters[0]?.connection).toEqual(PORT);
      });
      await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
      expect(api.connect).toHaveBeenCalledWith(PORT);
    });

    it('Connect on a roaster that is not active makes it active first', async () => {
      const roasters = [
        { ...SKYWALKER, active: false, connection: PORT },
        { ...SIMULATOR, active: true },
      ];
      const { api } = renderApp(<RoastersScreen />, { roasters }, fakeApi({ listPorts: ports }));
      await userEvent.click(sidebar().getByRole('button', { name: /^Skywalker/ }));
      await screen.findByText('Silicon Labs');
      await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
      expect(api.setActiveRoaster).toHaveBeenCalledWith(SKYWALKER.id);
      expect(api.connect).toHaveBeenCalledWith(PORT);
      expect(api.setActiveRoaster.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(
        api.connect.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("doesn't connect when the roaster can't be made active, and says why", async () => {
      const roasters = [
        { ...SKYWALKER, active: false, connection: PORT },
        { ...SIMULATOR, active: true },
      ];
      const api = fakeApi({
        listPorts: ports,
        setActiveRoaster: vi.fn(() => Promise.resolve(err({ kind: 'in-use' as const }))),
      });
      renderApp(<RoastersScreen />, { roasters }, api);
      await userEvent.click(sidebar().getByRole('button', { name: /^Skywalker/ }));
      await screen.findByText('Silicon Labs');
      await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
      });
      expect(api.connect).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Disconnect first');
    });

    it('says when there are no ports, and Refresh looks again', async () => {
      const listPorts = vi.fn(() => Promise.resolve([]));
      renderApp(<RoastersScreen />, { roasters: roastersWith(null) }, fakeApi({ listPorts }));
      expect(await screen.findByText(/No roaster found/)).toBeInTheDocument();
      expect(screen.queryByText('Pick a port to connect')).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      expect(listPorts).toHaveBeenCalledTimes(2);
    });

    it('shows the remembered port alone; Choose another opens likely roasters, then all ports', async () => {
      const listPorts = () =>
        Promise.resolve([
          { path: '/dev/cu.debug-console' },
          { path: '/dev/cu.usbserial-0001', manufacturer: 'Silicon Labs' },
          { path: '/dev/cu.usbserial-0002', manufacturer: 'WCH' },
        ]);
      renderApp(<RoastersScreen />, { roasters: roastersWith(PORT) }, fakeApi({ listPorts }));
      const list = within(screen.getByRole('list', { name: 'Ports' }));
      expect(await list.findByText('Silicon Labs')).toBeInTheDocument();
      expect(list.getAllByRole('button')).toHaveLength(1);
      await userEvent.click(screen.getByRole('button', { name: 'Choose another' }));
      expect(list.getAllByRole('button')).toHaveLength(2);
      expect(list.queryByText(/debug-console/)).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Show all ports (1 more)' }));
      expect(list.getByText(/debug-console/)).toBeInTheDocument();
    });
  });

  describe('connecting the Simulator', () => {
    const open = async (api = fakeApi()) => {
      const rendered = renderApp(<RoastersScreen />, { roasters: roastersWith(null) }, api);
      await userEvent.click(sidebar().getByRole('button', { name: /^Simulator/ }));
      return rendered;
    };

    it('has no port to pick and connects to the Simulator', async () => {
      const { api } = await open();
      expect(screen.queryByRole('list', { name: 'Ports' })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
      expect(api.setActiveRoaster).toHaveBeenCalledWith(SIMULATOR.id);
      expect(api.connect).toHaveBeenCalledWith({ kind: 'simulator' });
    });

    it('says why a connect failed, in one line', async () => {
      await open(
        fakeApi({ connect: () => Promise.resolve(err({ kind: 'no-reply', command: 'VERSION' })) }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('No reply');
    });

    it('while connecting: a busy Connect button, then the reason it failed', async () => {
      let finish: (value: Awaited<ReturnType<RoastpilotApi['connect']>>) => void = () => undefined;
      await open(
        fakeApi({
          connect: () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
      const busy = await screen.findByRole('button', { name: 'Connecting…' });
      expect(busy).toBeDisabled();
      expect(busy).toHaveAttribute('aria-busy', 'true');
      act(() => {
        finish(err({ kind: 'version-mismatch', expected: 1, actual: null }));
      });
      expect(await screen.findByRole('alert')).toHaveTextContent('No reply from the roaster');
      expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled();
    });
  });

  describe('while a roaster is in use', () => {
    it('its page shows Connecting… while main reports connecting', () => {
      renderApp(<RoastersScreen />, {
        connection: { status: 'connecting', target: { kind: 'simulator' } },
        roasters: roastersWith({ kind: 'simulator' }),
      });
      expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Disconnect' })).toBeNull();
    });

    it('its page shows the port in use, locked, Connected and Disconnect', async () => {
      const { api } = renderApp(<RoastersScreen />, {
        connection: CONNECTED,
        roasters: roastersWith(PORT),
      });
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /usbserial-0001/ })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      expect(api.disconnect).toHaveBeenCalledOnce();
    });

    it('every other page says to disconnect it first, and records wait', async () => {
      renderApp(<RoastersScreen />, { connection: CONNECTED, roasters: roastersWith(PORT) });
      await userEvent.click(sidebar().getByRole('button', { name: /^Simulator/ }));
      expect(screen.getByText('Disconnect Skywalker to switch')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
      expect(screen.getByRole('textbox', { name: 'Max temp' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: /^More for / })).toBeNull();
    });
  });

  describe('the record', () => {
    it('saves an edit, and holds Save back while a cell has a problem', async () => {
      const { api } = renderApp(<RoastersScreen />, { roasters: roastersWith(null) });
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

    it('turns the bean cooler helping the drum off, and saves it', async () => {
      const { api } = renderApp(<RoastersScreen />, { roasters: roastersWith(null) });
      const helps = screen.getByRole('switch', { name: 'Bean cooler helps cool the drum' });
      expect(helps).toBeChecked();
      await userEvent.click(helps);
      expect(helps).not.toBeChecked();
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(api.saveRoaster).toHaveBeenCalledWith(
        expect.objectContaining({ coolerHelpsDrum: false }),
      );
    });

    it('offers Drum speed only on a roaster whose drum has one, and saves it', async () => {
      const { api } = renderApp(<RoastersScreen />, { roasters: roastersWith(null) });
      expect(screen.queryByRole('group', { name: 'Drum' })).toBeNull();
      await userEvent.click(sidebar().getByRole('button', { name: /^Simulator/ }));
      const drum = within(screen.getByRole('group', { name: 'Drum' }));
      expect(drum.getByText('Usual speed · from Preheat, and while cooling')).toBeInTheDocument();
      const speed = drum.getByLabelText('Drum speed');
      expect(speed).toHaveValue('60');
      await userEvent.clear(speed);
      await userEvent.type(speed, '45');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(api.saveRoaster).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'simulator', drumSpeedPct: 45 }),
      );
    });

    it('keeps the tuning closed, in plain words, until asked', async () => {
      const { api } = renderApp(<RoastersScreen />, { roasters: roastersWith(null) });
      expect(screen.queryByRole('group', { name: 'Reaching step temperatures' })).toBeNull();
      const toggle = screen.getByRole('button', { name: 'Advanced tuning · for experts' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(/Push \(Kp\): how hard the heater reacts/)).toBeInTheDocument();
      const steps = within(screen.getByRole('group', { name: 'Reaching step temperatures' }));
      expect(
        steps.getByRole('textbox', { name: 'Most it may change (limit)' }),
      ).toBeInTheDocument();
      const push = steps.getByRole('textbox', { name: 'Push (Kp)' });
      await userEvent.clear(push);
      await userEvent.type(push, '2');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(api.saveRoaster.mock.calls[0]?.[0].tuning.target.kp).toBe(2);
    });

    it('a tuning number with a problem keeps the section open', async () => {
      renderApp(<RoastersScreen />, { roasters: roastersWith(null) });
      const toggle = screen.getByRole('button', { name: 'Advanced tuning · for experts' });
      await userEvent.click(toggle);
      const follow = within(screen.getByRole('group', { name: 'Following a curve' }));
      await userEvent.clear(follow.getByRole('textbox', { name: 'Catch-up (Ki)' }));
      await userEvent.click(toggle);
      expect(screen.getByText('Enter a number')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('says why a roaster with roasts stays', async () => {
      const api = fakeApi({
        deleteRoaster: vi.fn(() =>
          Promise.resolve(err({ kind: 'has-roasts' as const, roasts: 2, profiles: 0 })),
        ),
      });
      renderApp(<RoastersScreen />, { roasters: roastersWith(null) }, api);
      await userEvent.click(sidebar().getByRole('button', { name: /^Simulator/ }));
      await userEvent.click(screen.getByRole('button', { name: 'More for Simulator' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      await userEvent.click(
        within(screen.getByRole('alertdialog', { name: 'Delete this roaster?' })).getByRole(
          'button',
          { name: 'Delete' },
        ),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent('saved roasts or profiles');
    });

    it('after a delete, opens the active roaster', async () => {
      renderApp(<RoastersScreen />, { roasters: roastersWith(null) });
      await userEvent.click(sidebar().getByRole('button', { name: /^Simulator/ }));
      await userEvent.click(screen.getByRole('button', { name: 'More for Simulator' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      await userEvent.click(
        within(screen.getByRole('alertdialog', { name: 'Delete this roaster?' })).getByRole(
          'button',
          { name: 'Delete' },
        ),
      );
      expect(
        await screen.findByRole('heading', { level: 2, name: 'Skywalker' }),
      ).toBeInTheDocument();
    });
  });
});
