import { AUTO_OFF, DEFAULT_SETTINGS, err, READY_ROAST, type Reading } from '@roastpilot/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlotEngineProvider, type PlotEngine } from '@roastpilot/ui';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { pick } from '../../test/pick';
import { addReading } from '../../stores/roast-store';
import { BEAN } from '../../test/beans';
import { SKYWALKER } from '../../test/roasters';
import { BUILT_INS as profiles } from '../../test/profiles';
import { CONNECTED, fakeApi, renderApp } from '../../test/render-app';
import { RoastScreen } from './RoastScreen';

const roast = (phase: (typeof READY_ROAST)['phase']) => ({ ...READY_ROAST, phase });
const reading = (values: Reading['values'], atMs = 1000): Reading => ({ atMs, values });
const connected = { connection: CONNECTED };
/** The setup card starts closed; Change opens the rest of it. */
const openSetup = () =>
  userEvent.click(
    within(screen.getByRole('region', { name: 'Setup' })).getByRole('button', {
      name: 'Change setup',
    }),
  );
const onConnect = () => undefined;

describe('RoastScreen', () => {
  it('when not connected, the one action is Connect a roaster', async () => {
    const go = vi.fn();
    renderApp(<RoastScreen onConnect={go} />);
    await userEvent.click(screen.getByRole('button', { name: 'Connect a roaster' }));
    expect(go).toHaveBeenCalledOnce();
    // Nothing to control yet: no sliders or switches, only the setup card under Connect.
    expect(screen.queryByRole('slider', { name: 'Heater' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Drum' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Setup' })).toBeInTheDocument();
  });

  it.each([
    ['ready', 'Preheat', 'preheat'],
    ['preheat', 'Beans in · Start', 'start'],
    ['roasting', 'First crack', 'first-crack'],
    ['development', 'Drop now', 'drop'],
    ['done', 'Preheat', 'preheat'],
  ] as const)('%s: the next action is %s', async (phase, label, action) => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast(phase),
    });
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(api.roastAction).toHaveBeenCalledWith(action);
  });

  it('done: asks how the finished roast went in its own labelled card', async () => {
    const saved = {
      id: 1,
      startedAt: '2026-11-04T10:00:00.000Z',
      endedAt: '2026-11-04T10:12:00.000Z',
      fcTimeS: 480,
      fcTemp: null,
      dropTimeS: 570,
      dropTemp: 205,
      roasterId: null,
      beanId: null,
      ghostRoastId: null,
      batchG: 400,
      roastedG: null,
      rating: null,
      isFavourite: false,
      notes: null,
      profileId: null,
      profileName: null,
      imported: false,
    };
    const api = fakeApi({ listRoasts: vi.fn(() => Promise.resolve([saved])) });
    const { stores } = renderApp(
      <RoastScreen onConnect={onConnect} />,
      { ...connected, roast: { ...roast('done'), chargedAtMs: 1000 } },
      api,
    );
    act(() => {
      stores.beans.setState({ currentRoastId: 1 });
    });
    const card = await screen.findByRole('region', { name: 'Roast just finished' });
    expect(within(card).getByRole('region', { name: 'How it went' })).toBeInTheDocument();
    expect(card).not.toContainElement(screen.getByRole('button', { name: 'Preheat' }));
  });

  it('while roasting, Drop now is there too, for a roast without a first crack', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast('roasting'),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Drop now' }));
    expect(api.roastAction).toHaveBeenCalledWith('drop');
  });

  it('a refused action changes nothing on screen, and says so in a toast', async () => {
    const api = fakeApi({
      roastAction: () =>
        Promise.resolve(err({ kind: 'not-allowed', action: 'preheat', phase: 'roasting' })),
    });
    const { stores } = renderApp(
      <RoastScreen onConnect={onConnect} />,
      { ...connected, roast: roast('ready') },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Preheat' }));
    expect(screen.getByRole('button', { name: 'Preheat' })).toBeInTheDocument();
    await waitFor(() => {
      expect(stores.toasts.getState().toasts.map((t) => t.text)).toEqual([
        "Can't start preheat now · the roast has moved on",
      ]);
    });
  });

  it('a flow button whose call fails says so in a toast', async () => {
    const api = fakeApi({ roastAction: () => Promise.reject(new Error('ipc')) });
    const { stores } = renderApp(
      <RoastScreen onConnect={onConnect} />,
      { ...connected, roast: roast('ready') },
      api,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Preheat' }));
    await waitFor(() => {
      expect(stores.toasts.getState().toasts.map((t) => t.text)).toEqual([
        "Couldn't start preheat · try again",
      ]);
    });
  });

  it('cooling: +1 min adds a minute', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: { ...roast('cooling'), coolingEndsAtMs: 200_000 },
    });
    await userEvent.click(screen.getByRole('button', { name: '+1 min' }));
    expect(api.roastAction).toHaveBeenCalledWith('extend-cooling');
  });

  it('roasting: says when the charge point was found before the press', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: { ...roast('roasting'), chargedAtMs: 10_000, startPressedAtMs: 17_262 },
    });
    expect(
      screen.getByText('Charge found 0:07 before you pressed · press at first crack.'),
    ).toBeInTheDocument();
  });

  describe('drum cooling', () => {
    it.each(['ready', 'done'] as const)(
      'in %s with a hot drum, offers Cool the drum',
      async (phase) => {
        const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
          ...connected,
          roast: roast(phase),
          readings: [reading({ bt: 92 })],
        });
        await userEvent.click(screen.getByRole('button', { name: 'Cool the drum' }));
        expect(api.roastAction).toHaveBeenCalledWith('cool-roaster');
      },
    );

    it('not below 60 °C, nor during a roast', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, {
        ...connected,
        roast: roast('done'),
        readings: [reading({ bt: 59 })],
      });
      expect(screen.queryByRole('button', { name: 'Cool the drum' })).not.toBeInTheDocument();
    });

    it('while it runs: the temperature it is heading to, and Stop', async () => {
      const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
        ...connected,
        roast: { ...roast('done'), roasterCoolingSinceMs: 0, roasterCoolToC: 50 },
        readings: [reading({ bt: 92.4 })],
      });
      expect(screen.getByText('Cooling the drum · 92 °C → 50 °C')).toHaveRole('status');
      expect(screen.queryByRole('button', { name: 'Cool the drum' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
      expect(api.roastAction).toHaveBeenCalledWith('stop-cooling-roaster');
    });
  });

  it('cooling: the countdown, no next step, and the outputs say why they are locked', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: { ...roast('cooling'), coolingEndsAtMs: 200_000 },
      readings: [reading({ bt: 150 }, 20_000)],
    });
    expect(screen.queryByRole('button', { name: /Preheat|Drop|Start/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('Dump the beans into the cooling tray. 3:00 left.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Cooling beans · heater off, fan at 100%')).toBeInTheDocument();
  });

  const OFF = 'Heater, fan, drum and filter off now';
  const ENDED = `${OFF} No bean cooling · dump the beans yourself The roast is saved as it is`;
  it.each([
    [
      'preheat',
      'End roast',
      'End the roast?',
      `${OFF} Back to Ready · the preheat isn't saved`,
      'Keep roasting',
    ],
    ['roasting', 'End roast', 'End the roast?', ENDED, 'Keep roasting'],
    ['development', 'End roast', 'End the roast?', ENDED, 'Keep roasting'],
    [
      'cooling',
      'Finish cooling now',
      'Finish cooling the beans?',
      'the countdown ends now',
      'Cancel',
    ],
  ] as const)('%s: %s asks once, then ends', async (phase, label, question, what, keep) => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast(phase),
    });
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(api.roastAction).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: question });
    expect(dialog).toHaveAccessibleDescription(what);
    await userEvent.click(within(dialog).getByRole('button', { name: keep }));
    expect(api.roastAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: label }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: label }),
    );
    expect(api.roastAction).toHaveBeenCalledWith('end');
  });

  it.each(['ready', 'done'] as const)('%s has no End roast', (phase) => {
    renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast(phase) });
    expect(
      screen.queryByRole('button', { name: /End roast|Finish cooling/ }),
    ).not.toBeInTheDocument();
  });

  it('names the temperature as the connected roaster does', () => {
    const beanProbe = {
      ...CONNECTED,
      channels:
        CONNECTED.status === 'connected'
          ? [
              {
                id: 'bt',
                kind: 'sensor',
                unit: 'celsius',
                name: 'Bean temperature',
                short: 'BT',
              } as const,
              ...CONNECTED.channels.slice(1),
            ]
          : [],
    };
    renderApp(<RoastScreen onConnect={onConnect} />, {
      connection: beanProbe,
      roast: roast('roasting'),
      readings: [reading({ bt: 150 }, 60_000)],
    });
    expect(screen.getByRole('region', { name: 'Bean temperature' })).toHaveTextContent('150.0°C');
  });

  it('marks where the roast is', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('development') });
    expect(screen.getByText('First crack', { selector: 'li span' }).closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('shows the numbers first', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: { ...roast('development'), chargedAtMs: 0, firstCrackAtMs: 400_000 },
      readings: [reading({ bt: 201.26 }, 500_000)],
    });
    expect(screen.getByRole('region', { name: 'Temperature' })).toHaveTextContent('201.3°C');
    expect(screen.getByRole('region', { name: 'Time' })).toHaveTextContent('8:20');
    expect(screen.getByRole('region', { name: 'Development' })).toHaveTextContent(
      '1:4020% of the roast',
    );
  });

  describe('Guided', () => {
    it.each(['ready', 'done'] as const)(
      'with no roast running (%s), everything but the heater works',
      (phase) => {
        renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast(phase) });
        expect(screen.getByRole('slider', { name: 'Heater' })).toBeDisabled();
        expect(screen.getByRole('slider', { name: 'Fan' })).toBeEnabled();
        expect(screen.getByRole('switch', { name: 'Drum' })).toBeEnabled();
        expect(screen.getByRole('switch', { name: 'Bean cooler' })).toBeEnabled();
        expect(screen.getByText('Heater waits for Preheat')).toBeInTheDocument();
      },
    );

    it('roasting hides the bean cooler switch, as Drop handles cooling', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('roasting') });
      expect(screen.queryByRole('switch', { name: 'Bean cooler' })).not.toBeInTheDocument();
    });

    it('from Preheat the sliders are live', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('preheat') });
      expect(screen.getByRole('slider', { name: 'Heater' })).toBeEnabled();
    });
  });

  it('Full control: everything is live, bean cooler switch included', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      settings: { ...DEFAULT_SETTINGS, connection: null, controls: 'full', chartSmoothingS: 5 },
      readings: [reading({ cooling: 0 })],
    });
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeEnabled();
    await userEvent.click(screen.getByRole('switch', { name: 'Bean cooler' }));
    expect(api.setOutput).toHaveBeenCalledWith({ channel: 'cooling', value: 100 });
  });

  it('Clear empties the chart and the numbers, and hides until the next roast', async () => {
    const { api, stores } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: { ...roast('done'), chargedAtMs: 0 },
      readings: [reading({ bt: 40 })],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(api.roastAction).toHaveBeenCalledWith('clear');
    expect(stores.roast.getState().readings).toEqual([]);
    // Main answers with Ready; idle readings keep coming, and they are not a roast to clear.
    act(() => {
      stores.roast.setState((s) => addReading({ ...s, roast: READY_ROAST }, reading({ bt: 39 })));
    });
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('Clear works with no roaster too, and offers itself after a preheat ended early', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      roast: { ...roast('ready'), preheatAtMs: 0 },
      readings: [reading({ bt: 40 })],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(api.roastAction).toHaveBeenCalledWith('clear');
  });

  it('a refused Clear keeps the chart', async () => {
    const { stores } = renderApp(
      <RoastScreen onConnect={onConnect} />,
      { roast: { ...roast('done'), chargedAtMs: 0 }, readings: [reading({ bt: 40 })] },
      fakeApi({
        roastAction: () =>
          Promise.resolve(err({ kind: 'not-allowed', action: 'clear', phase: 'roasting' })),
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(stores.roast.getState().readings).toHaveLength(1);
  });

  describe('Clear with bean setup (stock-return prompt)', () => {
    const beanSetup = { beanId: 1, batchG: 350, ghostRoastId: null };
    const testBean = {
      id: 1,
      name: 'Ethiopia Yirgacheffe',
      origin: 'Ethiopia',
      process: 'washed' as const,
      variety: null,
      altitudeM: null,
      densityGL: null,
      moisturePct: null,
      screen: null,
      decaf: false,
      supplier: null,
      lowStockG: 0,
      notes: null,
      profileId: null,
      greenG: 500,
      roastedG: 0,
      archived: false,
      avgLossPct: null,
      batchPlan: null,
    };

    it('clicking Clear in done phase with bean setup shows the stock-return prompt', async () => {
      renderApp(<RoastScreen onConnect={onConnect} />, {
        ...connected,
        roast: { ...roast('done'), chargedAtMs: 0 },
        setup: beanSetup,
        beans: [testBean],
      });
      await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
      expect(
        screen.getByText(/Return 350 g of Ethiopia Yirgacheffe to stock\?/),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Return to stock' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Keep deducted' })).toBeInTheDocument();
    });

    it('"Return to stock" calls adjustStock then clears the roast', async () => {
      const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
        ...connected,
        roast: { ...roast('done'), chargedAtMs: 0 },
        setup: beanSetup,
        beans: [testBean],
      });
      await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
      await userEvent.click(screen.getByRole('button', { name: 'Return to stock' }));
      expect(api.adjustStock).toHaveBeenCalledWith({ beanId: 1, greenG: 350, roastedG: 0 });
      expect(api.roastAction).toHaveBeenCalledWith('clear');
    });

    it('"Keep deducted" clears without calling adjustStock', async () => {
      const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
        ...connected,
        roast: { ...roast('done'), chargedAtMs: 0 },
        setup: beanSetup,
        beans: [testBean],
      });
      await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
      await userEvent.click(screen.getByRole('button', { name: 'Keep deducted' }));
      expect(api.adjustStock).not.toHaveBeenCalled();
      expect(api.roastAction).toHaveBeenCalledWith('clear');
    });

    it('ready phase with bean setup goes straight to clear (stock not deducted yet)', async () => {
      const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
        roast: { ...roast('ready'), preheatAtMs: 0 },
        setup: beanSetup,
        beans: [testBean],
      });
      await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
      expect(api.adjustStock).not.toHaveBeenCalled();
      expect(api.roastAction).toHaveBeenCalledWith('clear');
      expect(screen.queryByText(/Return.*to stock/)).not.toBeInTheDocument();
    });
  });

  it('no Clear without a roast on screen, even with idle readings', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast('ready'),
      readings: [reading({ bt: 22 })],
    });
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it.each(['preheat', 'roasting', 'cooling'] as const)('no Clear while %s', (phase) => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast(phase),
      readings: [reading({ bt: 40 })],
    });
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it.each(['preheat', 'roasting', 'cooling'] as const)(
    '%s: the legends show the latest values without hovering',
    (phase) => {
      renderApp(<RoastScreen onConnect={onConnect} />, {
        ...connected,
        roast: { ...roast(phase), chargedAtMs: 0 },
        readings: [reading({ bt: 184, heater: 40, fan: 80 })],
      });
      expect(screen.getByRole('list', { name: 'Legend' })).toHaveTextContent('Temperature184.0 °C');
      expect(screen.getByRole('list', { name: 'Outputs legend' })).toHaveTextContent(
        'Heater40%Fan80%',
      );
    },
  );

  it.each(['ready', 'done'] as const)('%s: the legends show names only', (phase) => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: { ...roast(phase), chargedAtMs: 0 },
      readings: [reading({ bt: 184, heater: 40, fan: 80 })],
    });
    expect(screen.getByRole('list', { name: 'Legend' })).not.toHaveTextContent('184');
  });

  it('before a roast, a caution to stay close sits right above the action', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('ready') });
    const line = screen.getByText('Stay with the roaster while it runs');
    // Amber caution, never the red of a safety trip.
    expect(line).toHaveClass('text-warning');
    expect(line.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const action = screen.getByRole('button', { name: 'Preheat' });
    expect(line.nextElementSibling).toBe(action);
  });

  it.each(['preheat', 'roasting', 'cooling'] as const)(
    '%s: the same line, quiet, under the controls',
    (phase) => {
      renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast(phase) });
      const line = screen.getByText('Stay with the roaster while it runs');
      expect(line).toHaveClass('text-ink-muted');
      const outputs = screen.getByRole('region', { name: 'Outputs' });
      expect(outputs.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    },
  );

  it('says nothing about staying close once the roast is done', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('done') });
    expect(screen.queryByText('Stay with the roaster while it runs')).toBeNull();
  });

  it('with no roaster, the last readings never show as live values', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      roast: roast('preheat'),
      readings: [reading({ bt: 42.7, heater: 0, fan: 100, drum: 1 })],
    });
    expect(screen.queryByText('42.7')).not.toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Drum' })).toBeNull();
  });

  it('connection lost: Reconnecting with nothing to press, and dashes instead of old values', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      connection: { status: 'lost', target: { kind: 'simulator' } },
      roast: roast('roasting'),
      readings: [reading({ heater: 30, fan: 60, bt: 48 })],
    });
    expect(screen.getByText('Reconnecting… · check the cable')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('button', { name: 'Connect a roaster' })).not.toBeInTheDocument();
    expect(screen.queryByText('30%')).not.toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeDisabled();
  });

  it('the stepper shows how long finished stages took, and Time counts the preheat', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: { ...roast('roasting'), preheatAtMs: 0, chargedAtMs: 250_000 },
      readings: [reading({ bt: 150 }, 310_000)],
    });
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('4:10');
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('the drum switch shows the reading and overrides it', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast('roasting'),
      readings: [reading({ drum: 1 })],
    });
    const drum = screen.getByRole('switch', { name: 'Drum' });
    expect(drum).toBeChecked();
    await userEvent.click(drum);
    expect(api.setOutput).toHaveBeenCalledWith({ channel: 'drum', value: 0 });
  });

  it('a switch the roaster refuses or never gets says so in a toast; the safety lock does not', async () => {
    const api = fakeApi({
      setOutput: vi
        .fn()
        .mockResolvedValueOnce(err({ kind: 'no-reply' as const, command: 'DRUM' }))
        .mockRejectedValueOnce(new Error('ipc'))
        .mockResolvedValueOnce(err({ kind: 'safety-locked' as const, channel: 'filter' })),
    });
    const { stores } = renderApp(
      <RoastScreen onConnect={onConnect} />,
      { ...connected, roast: roast('roasting'), readings: [reading({ drum: 1, filter: 0 })] },
      api,
    );
    const texts = () => stores.toasts.getState().toasts.map((t) => t.text);
    await userEvent.click(screen.getByRole('switch', { name: 'Drum' }));
    await waitFor(() => {
      expect(texts()).toEqual(["Couldn't set the drum · try again"]);
    });
    await userEvent.click(screen.getByRole('switch', { name: 'Filter' }));
    await waitFor(() => {
      expect(texts()).toEqual([
        "Couldn't set the drum · try again",
        "Couldn't set the filter · try again",
      ]);
    });
    stores.toasts.setState({ toasts: [] });
    await userEvent.click(screen.getByRole('switch', { name: 'Filter' }));
    await waitFor(() => {
      expect(api.setOutput).toHaveBeenCalledTimes(3);
    });
    expect(texts()).toEqual([]);
  });

  it('a drum with a speed is a slider under the fan, sent when you let go', () => {
    const channels = CONNECTED.status === 'connected' ? CONNECTED.channels : [];
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      connection: {
        ...CONNECTED,
        channels: channels.map((c) =>
          c.id === 'drum' ? { ...c, unit: 'percent' as const, max: 100, step: 5 } : c,
        ),
      } as typeof CONNECTED,
      roast: roast('roasting'),
      readings: [reading({ drum: 60 })],
    });
    const outputs = within(screen.getByRole('region', { name: 'Outputs' }));
    const drum = outputs.getByRole('slider', { name: 'Drum' });
    expect(drum).toHaveValue('60');
    expect(outputs.queryByRole('switch', { name: 'Drum' })).toBeNull();
    expect(outputs.getByRole('switch', { name: 'Filter' })).toBeInTheDocument();
    fireEvent.pointerDown(drum);
    fireEvent.change(drum, { target: { value: '45' } });
    fireEvent.pointerUp(window);
    expect(api.setOutput).toHaveBeenCalledWith({ channel: 'drum', value: 45 });
  });

  it('the filter fan switch shows the reading and overrides it', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast('preheat'),
      readings: [reading({ filter: 1 })],
    });
    const filter = screen.getByRole('switch', { name: 'Filter' });
    expect(filter).toBeChecked();
    await userEvent.click(filter);
    expect(api.setOutput).toHaveBeenCalledWith({ channel: 'filter', value: 0 });
  });

  it('heater on with the drum off says so, without blocking', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast('roasting'),
      readings: [reading({ heater: 40, drum: 0 })],
    });
    expect(screen.getByText('Drum is off')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeEnabled();
  });

  it('a locked heater is disabled and says why; the fan still works', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast('roasting'),
      safety: { locked: true, tripped: [] },
    });
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Fan' })).toBeEnabled();
    expect(screen.getByText('Heater locked · acknowledge above')).toBeInTheDocument();
  });

  describe('sliders', () => {
    /** Moves the slider the way the browser does: sets its value, then fires input. */
    const move = (input: HTMLElement, value: string) => {
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          input,
          value,
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    /** A drag: press, move through `values`, let go. */
    const slide = (input: HTMLElement, ...values: string[]) => {
      fireEvent.pointerDown(input);
      for (const value of values) move(input, value);
      fireEvent.pointerUp(window);
    };
    const setup = (api = fakeApi()) =>
      renderApp(
        <RoastScreen onConnect={onConnect} />,
        { ...connected, roast: roast('roasting'), readings: [reading({ heater: 50 })] },
        api,
      );

    it('show your value until the roaster reports a change, then follow the readings', () => {
      const { api, stores } = setup();
      const heater = screen.getByRole('slider', { name: 'Heater' });
      act(() => {
        heater.focus();
      });
      slide(heater, '60', '65', '70');
      // Only the value you let go on goes to the roaster.
      expect(api.setOutput).toHaveBeenCalledExactlyOnceWith({ channel: 'heater', value: 70 });
      expect(heater).toHaveValue('70');
      // A reading from before the command landed doesn't pull the slider back.
      act(() => {
        stores.roast.setState((s) => addReading(s, reading({ heater: 50 }, 2000)));
      });
      expect(heater).toHaveValue('70');
      act(() => {
        stores.roast.setState((s) => addReading(s, reading({ heater: 70 }, 3000)));
      });
      act(() => {
        stores.roast.setState((s) => addReading(s, reading({ heater: 0 }, 4000)));
      });
      expect(heater).toHaveValue('0');
    });

    it('follow the roaster when it changes the value back, e.g. heater 0 at Drop', () => {
      const { stores } = setup();
      const heater = screen.getByRole('slider', { name: 'Heater' });
      slide(heater, '100');
      act(() => {
        stores.roast.setState((s) => addReading(s, reading({ heater: 100 }, 2000)));
      });
      act(() => {
        stores.roast.setState((s) => addReading(s, reading({ heater: 50 }, 2500)));
      });
      expect(heater).toHaveValue('50');
    });

    it('follow the readings after two polls whatever they say', () => {
      const { stores } = setup();
      const heater = screen.getByRole('slider', { name: 'Heater' });
      slide(heater, '70');
      act(() => {
        stores.roast.setState((s) => addReading(s, reading({ heater: 50 }, 3000)));
      });
      expect(heater).toHaveValue('50');
    });

    it('snap back when the roaster refuses', async () => {
      const api = fakeApi({
        setOutput: () => Promise.resolve(err({ kind: 'safety-locked', channel: 'heater' })),
      });
      setup(api);
      const heater = screen.getByRole('slider', { name: 'Heater' });
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          heater,
          '70',
        );
        heater.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await vi.waitFor(() => {
        expect(heater).toHaveValue('50');
      });
    });
  });

  describe('Auto', () => {
    const settings = { ...DEFAULT_SETTINGS, roastMode: 'auto' } as const;
    const on = { ...AUTO_OFF, enabled: true };
    const auto = (phase: (typeof READY_ROAST)['phase'], status = {}) => ({
      ...connected,
      roast: roast(phase),
      settings,
      profiles,
      auto: { ...on, ...status },
    });

    it('stays Manual with no profile choice until you pick Auto', async () => {
      const { api } = renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, profiles });
      expect(screen.queryByLabelText('Profile')).toBeNull();
      await userEvent.click(screen.getByRole('switch', { name: 'Auto' }));
      expect(api.setSettings).toHaveBeenCalledWith(expect.objectContaining({ roastMode: 'auto' }));
      await openSetup();
      expect(screen.getByLabelText('Profile')).toHaveTextContent('Light · Steps');
      expect(screen.getByText('Needs calibration · stay close.')).toBeInTheDocument();
    });

    it('mid-roast shows how far the roast is from the plan, and the RoR the step aims for', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, {
        ...auto('roasting', { phaseName: 'Development' }),
        roast: { ...roast('roasting'), chargedAtMs: 0 },
        readings: [reading({ bt: 120 }, 450_000)],
      });
      expect(screen.getByText(/^−\d+ °C vs plan$/)).toBeInTheDocument();
      // No first-crack tap yet: never below the stall guard's 5.
      expect(screen.getByText('Aim 5–7')).toBeInTheDocument();
    });

    it('shows neither in a manual roast', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, {
        ...connected,
        roast: { ...roast('roasting'), chargedAtMs: 0 },
        readings: [reading({ bt: 120 }, 450_000)],
      });
      expect(screen.queryByText(/vs plan/)).toBeNull();
      expect(screen.queryByText(/^Aim /)).toBeNull();
    });

    it('says a profile needs calibration as a badge beside the folded setup line', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, auto('ready'));
      const row = screen.getByRole('button', { name: 'Change setup' });
      expect(row).toHaveTextContent(/^Light · Steps · No bean/);
      expect(within(row).getByText('Needs calibration')).not.toHaveClass('truncate');
    });

    it('shows Needs calibration as a badge in the profile picker, the name alone', async () => {
      renderApp(<RoastScreen onConnect={onConnect} />, auto('ready'));
      await openSetup();
      expect(screen.getByLabelText('Profile')).toHaveTextContent(
        /^Light · StepsNeeds calibration$/,
      );
    });

    it('shows no badge for a calibrated profile', async () => {
      renderApp(<RoastScreen onConnect={onConnect} />, {
        ...auto('ready'),
        profiles: profiles.map((e) => ({
          ...e,
          profile: { ...e.profile, needsCalibration: false },
        })),
      });
      expect(screen.queryByText('Needs calibration')).toBeNull();
      await openSetup();
      expect(screen.getByLabelText('Profile')).toHaveTextContent(/^Light · Steps$/);
    });

    it("starts the batch at the profile's tuned-for batch without a plan, and warns when far off", async () => {
      const { stores } = renderApp(<RoastScreen onConnect={onConnect} />, {
        ...auto('ready'),
        beans: [{ ...BEAN, batchPlan: null, greenG: 2000 }],
        roasters: [SKYWALKER],
      });
      await openSetup();
      await pick(screen.getByLabelText('Bean'), /^Yirgacheffe/);
      expect(stores.beans.getState().setup.batchG).toBe(385);
      expect(screen.queryByText(/^Profile tuned for/)).toBeNull();
      const batch = screen.getByLabelText('Batch');
      await userEvent.clear(batch);
      await userEvent.type(batch, '300');
      expect(
        screen.getByText('Profile tuned for 385 g · a 300 g batch runs hotter and faster'),
      ).toBeInTheDocument();
      // A note, not a block: Preheat stays.
      expect(screen.getByRole('button', { name: 'Preheat' })).toBeEnabled();
    });

    it("starts the batch at the bean's plan when it has one", async () => {
      const { stores } = renderApp(<RoastScreen onConnect={onConnect} />, {
        ...auto('ready'),
        beans: [{ ...BEAN, greenG: 2000 }],
        roasters: [SKYWALKER],
      });
      await openSetup();
      await pick(screen.getByLabelText('Bean'), /^Yirgacheffe/);
      expect(stores.beans.getState().setup.batchG).toBe(375);
    });

    it('labels the suggested profile, says why, and Use this profile picks it', async () => {
      const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
        ...auto('ready'),
        settings: { ...settings, autoProfile: 'light-curve' },
        beans: [BEAN],
        setup: { beanId: BEAN.id, batchG: 375, ghostRoastId: null },
        roasters: [SKYWALKER],
      });
      await openSetup();
      const row = screen.getByRole('region', { name: 'Suggested profile' });
      expect(row).toHaveTextContent(
        'Suggested profileLight · Steps' +
          'Use this profile' +
          'The default · star a roast of this bean to improve it',
      );
      // The bean hint says why it speaks.
      expect(
        screen.getByText(
          'Dense beans (830 g/L): these often take heat slowly · consider more heat early',
        ),
      ).toBeInTheDocument();
      await userEvent.click(within(row).getByRole('button', { name: 'Use this profile' }));
      expect(api.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoProfile: 'light-steps' }),
      );
    });

    it('hides the suggestion when it is already the profile picked', async () => {
      renderApp(<RoastScreen onConnect={onConnect} />, {
        ...auto('ready'),
        beans: [BEAN],
        setup: { beanId: BEAN.id, batchG: 375, ghostRoastId: null },
        roasters: [SKYWALKER],
      });
      await openSetup();
      expect(screen.queryByRole('region', { name: 'Suggested profile' })).toBeNull();
    });

    it('picks a profile', async () => {
      const { api } = renderApp(<RoastScreen onConnect={onConnect} />, auto('ready'));
      await openSetup();
      await pick(screen.getByLabelText('Profile'), /^Light · Curve/);
      expect(api.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoProfile: 'light-curve' }),
      );
    });

    it.each(['preheat', 'roasting', 'development'] as const)(
      'keeps the profile still in %s, named in the setup line',
      async (phase) => {
        renderApp(<RoastScreen onConnect={onConnect} />, auto(phase));
        await openSetup();
        expect(screen.queryByLabelText('Profile')).toBeNull();
        expect(screen.getByRole('region', { name: 'Setup' })).toHaveTextContent('Light · Steps');
        // The Auto switch itself stays live mid-roast.
        expect(screen.getByRole('switch', { name: 'Auto' })).toBeEnabled();
      },
    );

    it.each(['ready', 'cooling', 'done'] as const)('lets you choose again in %s', async (phase) => {
      renderApp(<RoastScreen onConnect={onConnect} />, auto(phase));
      await openSetup();
      expect(screen.getByLabelText('Profile')).toBeEnabled();
    });

    it('Charge soon asks main once the hold is over', async () => {
      const { api } = renderApp(
        <RoastScreen onConnect={onConnect} />,
        auto('preheat', { preheatStep: 'add-beans' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Charge soon' }));
      expect(api.autoChargeSoon).toHaveBeenCalledOnce();
    });

    it('shows Auto on an output it drives, and Manual with Resume auto on one you took', async () => {
      const { api } = renderApp(
        <RoastScreen onConnect={onConnect} />,
        auto('roasting', { fan: 'manual', phaseName: 'Yellowing', nextPhaseAtC: 165 }),
      );
      expect(screen.getByText('Yellowing · next at 165 °C')).toBeInTheDocument();
      const outputs = within(screen.getByRole('region', { name: 'Outputs' }));
      expect(outputs.getByText('Auto', { selector: 'span' })).toBeInTheDocument();
      // getByRole fails on more than one: only the fan you took offers it.
      await userEvent.click(screen.getByRole('button', { name: 'Resume auto' }));
      expect(api.autoResume).toHaveBeenCalledOnce();
    });

    it('after a stop says both outputs are yours, and offers no Resume auto while locked', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, {
        ...auto('roasting', { stopped: true, heater: 'manual', fan: 'manual' }),
        safety: { locked: true, tripped: [] },
      });
      expect(screen.queryByRole('button', { name: 'Resume auto' })).toBeNull();
      expect(screen.getByText('Heater locked · acknowledge above')).toBeInTheDocument();
    });

    it('offers no Resume auto and no badges in a manual roast', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('roasting') });
      expect(screen.queryByRole('button', { name: 'Resume auto' })).toBeNull();
      const outputs = within(screen.getByRole('region', { name: 'Outputs' }));
      expect(outputs.queryByText('Manual')).toBeNull();
      expect(outputs.queryByText('Auto')).toBeNull();
    });
  });

  it('hides the controls the connected roaster does not have', () => {
    const channels = CONNECTED.status === 'connected' ? CONNECTED.channels : [];
    renderApp(<RoastScreen onConnect={onConnect} />, {
      connection: {
        ...CONNECTED,
        channels: channels.filter((c) => c.id !== 'fan' && c.id !== 'filter'),
      } as typeof CONNECTED,
    });
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Fan' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Filter' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Drum' })).toBeInTheDocument();
  });

  describe('in °F', () => {
    // 31 s climbing 0.1 °C a second: RoR 6 °C/min.
    const climbing = Array.from({ length: 31 }, (_, i) =>
      reading({ bt: 180 + i * 0.1, heater: 60, fan: 40 }, 400_000 + i * 1000),
    );
    const created: Parameters<PlotEngine['create']>[0][] = [];
    const capturing: PlotEngine = {
      create: (options) => {
        created.push(options);
        return { setData: vi.fn(), redraw: vi.fn(), setSize: vi.fn(), destroy: vi.fn() };
      },
      stepped: () => undefined,
    };
    const inF = () => {
      created.length = 0;
      return renderApp(
        <PlotEngineProvider value={capturing}>
          <RoastScreen onConnect={onConnect} />
        </PlotEngineProvider>,
        {
          ...connected,
          roast: { ...roast('roasting'), chargedAtMs: 0 },
          readings: climbing,
          settings: { ...DEFAULT_SETTINGS, temperatureUnit: 'f' },
        },
      );
    };

    it('shows the temperature whole in °F and RoR × 1.8, never + 32', () => {
      inF();
      // 183.0 °C is 361.4 °F; 6 °C/min is 10.8 °F/min.
      expect(screen.getByRole('region', { name: 'Temperature' })).toHaveTextContent('361°F');
      expect(screen.getByRole('region', { name: 'RoR' })).toHaveTextContent('10.8°F/min');
    });

    it('draws the chart in °F: the axis grows in 100 °F steps', () => {
      inF();
      expect(
        screen.getByRole('img', { name: /^Temperature 361 °F, RoR 10\.8 °F\/min/ }),
      ).toBeInTheDocument();
      const range = created[0]?.scales?.temperature?.range;
      if (typeof range !== 'function') throw new Error('expected a temperature range');
      const top = (max: number) => range({} as never, 150, max, 'temperature')[1];
      expect(top(470)).toBe(482);
      expect(top(483)).toBe(500);
    });

    it('changes at once, mid-roast', () => {
      const { stores } = renderApp(<RoastScreen onConnect={onConnect} />, {
        ...connected,
        roast: { ...roast('roasting'), chargedAtMs: 0 },
        readings: climbing,
      });
      expect(screen.getByRole('region', { name: 'Temperature' })).toHaveTextContent('183.0°C');
      act(() => {
        stores.settings.setState((st) => ({
          settings: { ...st.settings, temperatureUnit: 'f' },
        }));
      });
      expect(screen.getByRole('region', { name: 'Temperature' })).toHaveTextContent('361°F');
    });
  });

  it('redraws the chart for a new reading, not for a render without one', async () => {
    const drawn = { setData: vi.fn(), redraw: vi.fn() };
    const counting: PlotEngine = {
      create: () => ({ ...drawn, setSize: vi.fn(), destroy: vi.fn() }),
      stepped: () => undefined,
    };
    /** Renders the Roast screen again on Again, with nothing in the stores changed. */
    function Host() {
      const [renders, setRenders] = useState(0);
      return (
        <PlotEngineProvider value={counting}>
          <button
            type="button"
            onClick={() => {
              setRenders(renders + 1);
            }}
          >
            Again
          </button>
          <RoastScreen onConnect={onConnect} />
        </PlotEngineProvider>
      );
    }
    const { stores } = renderApp(<Host />, {
      ...connected,
      roast: { ...roast('roasting'), chargedAtMs: 0 },
      readings: [reading({ bt: 180 }, 0), reading({ bt: 175 }, 1000)],
    });
    // The saved roasts and settings settle first.
    await act(async () => {
      await Promise.resolve();
    });
    drawn.setData.mockClear();
    drawn.redraw.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Again' }));
    expect(drawn.setData).not.toHaveBeenCalled();
    expect(drawn.redraw).not.toHaveBeenCalled();
    act(() => {
      stores.roast.setState((s) => addReading(s, reading({ bt: 172 }, 2000)));
    });
    expect(drawn.setData).toHaveBeenCalled();
  });
});
