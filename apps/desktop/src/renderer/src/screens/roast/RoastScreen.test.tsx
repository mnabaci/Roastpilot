import { DEFAULT_SETTINGS, err, READY_ROAST, type Reading } from '@roastpilot/shared';
import { act, fireEvent, screen } from '@testing-library/react';
import type * as Ui from '@roastpilot/ui';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addReading } from '../../stores/roast-store';
import { CONNECTED, fakeApi, renderApp } from '../../test/render-app';
import { RoastScreen } from './RoastScreen';

const roast = (phase: (typeof READY_ROAST)['phase']) => ({ ...READY_ROAST, phase });
const reading = (values: Reading['values'], atMs = 1000): Reading => ({ atMs, values });
const connected = { connection: CONNECTED };
const onConnect = () => undefined;

vi.mock('@roastpilot/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof Ui>()),
  RoastChart: (await import('../../test/fake-ui')).FakeRoastChart,
}));

describe('RoastScreen', () => {
  it('when not connected, the one action is Connect a roaster', async () => {
    const go = vi.fn();
    renderApp(<RoastScreen onConnect={go} />);
    await userEvent.click(screen.getByRole('button', { name: 'Connect a roaster' }));
    expect(go).toHaveBeenCalledOnce();
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeDisabled();
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

  it('while roasting, Drop now is there too, for a roast without a first crack', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast('roasting'),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Drop now' }));
    expect(api.roastAction).toHaveBeenCalledWith('drop');
  });

  it('a refused action changes nothing on screen', async () => {
    const api = fakeApi({
      roastAction: () =>
        Promise.resolve(err({ kind: 'not-allowed', action: 'preheat', phase: 'roasting' })),
    });
    renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('ready') }, api);
    await userEvent.click(screen.getByRole('button', { name: 'Preheat' }));
    expect(screen.getByRole('button', { name: 'Preheat' })).toBeInTheDocument();
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

  describe('roaster cool-down', () => {
    it.each(['ready', 'done'] as const)(
      'in %s with a hot drum, offers Cool down roaster',
      async (phase) => {
        const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
          ...connected,
          roast: roast(phase),
          readings: [reading({ bt: 92 })],
        });
        await userEvent.click(screen.getByRole('button', { name: 'Cool down roaster' }));
        expect(api.roastAction).toHaveBeenCalledWith('cool-roaster');
      },
    );

    it('not below 60 °C, nor during a roast', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, {
        ...connected,
        roast: roast('done'),
        readings: [reading({ bt: 59 })],
      });
      expect(screen.queryByRole('button', { name: 'Cool down roaster' })).not.toBeInTheDocument();
    });

    it('while it runs: the temperature it is heading to, and Stop', async () => {
      const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
        ...connected,
        roast: { ...roast('done'), roasterCoolingSinceMs: 0, roasterCoolToC: 50 },
        readings: [reading({ bt: 92.4 })],
      });
      expect(screen.getByText('Cooling the roaster · 92 °C → 50 °C')).toHaveRole('status');
      expect(screen.queryByRole('button', { name: 'Cool down roaster' })).not.toBeInTheDocument();
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
    expect(screen.getByText('Cooling · heater off, fan at 100%')).toBeInTheDocument();
  });

  it.each([
    ['preheat', 'End roast', 'End the roast?'],
    ['roasting', 'End roast', 'End the roast?'],
    ['development', 'End roast', 'End the roast?'],
    ['cooling', 'Finish cooling now', 'Finish cooling?'],
  ] as const)('%s: %s asks once, then ends', async (phase, label, question) => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast(phase),
    });
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(api.roastAction).not.toHaveBeenCalled();
    expect(
      screen.getByRole('group', { name: new RegExp(question.replace('?', '\\?')) }),
    ).toHaveTextContent('everything turns off');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.roastAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: label }));
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(api.roastAction).toHaveBeenCalledWith('end');
  });

  it.each(['ready', 'done'] as const)('%s has no End roast', (phase) => {
    renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast(phase) });
    expect(
      screen.queryByRole('button', { name: /End roast|Finish cooling/ }),
    ).not.toBeInTheDocument();
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
        expect(screen.getByRole('button', { name: /Drum/ })).toBeEnabled();
        expect(screen.getByRole('button', { name: /Cooling/ })).toBeEnabled();
        expect(screen.getByText('Heater waits for Preheat')).toBeInTheDocument();
      },
    );

    it('roasting hides the cooling switch, as Drop handles cooling', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('roasting') });
      expect(screen.queryByRole('button', { name: /Cooling/ })).not.toBeInTheDocument();
    });

    it('from Preheat the sliders are live', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('preheat') });
      expect(screen.getByRole('slider', { name: 'Heater' })).toBeEnabled();
    });
  });

  it('Full control: everything is live, cooling switch included', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      settings: { ...DEFAULT_SETTINGS, connection: null, controls: 'full', chartSmoothingS: 5 },
      readings: [reading({ cooling: 0 })],
    });
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /Cooling/ }));
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

  it('with no roaster, the last readings show as dashes, not live values', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      roast: roast('preheat'),
      readings: [reading({ bt: 42.7, heater: 0, fan: 100, drum: 1 })],
    });
    expect(screen.queryByText('42.7')).not.toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Drum/ })).toHaveAttribute('aria-pressed', 'false');
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
    const drum = screen.getByRole('button', { name: /Drum/ });
    expect(drum).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(drum);
    expect(api.setOutput).toHaveBeenCalledWith({ channel: 'drum', value: 0 });
  });

  it('the filter fan switch shows the reading and overrides it', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: roast('preheat'),
      readings: [reading({ filter: 1 })],
    });
    const filter = screen.getByRole('button', { name: /Filter/ });
    expect(filter).toHaveAttribute('aria-pressed', 'true');
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
});
