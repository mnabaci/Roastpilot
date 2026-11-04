import { err, type Reading } from '@roastpilot/shared';
import { act, screen } from '@testing-library/react';
import type * as Ui from '@roastpilot/ui';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addReading, READY_ROAST } from '../../stores/roast-store';
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

  it('cooling has no button, just the countdown', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      roast: { ...roast('cooling'), coolingEndsAtMs: 200_000 },
      readings: [reading({ bt: 150 }, 20_000)],
    });
    expect(screen.queryByRole('button', { name: /Preheat|Drop|Start/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('Dump the beans into the cooling tray. 3:00 left.'),
    ).toBeInTheDocument();
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
    it('heater and fan wait for Preheat; the drum and no cooling switch', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('ready') });
      expect(screen.getByRole('slider', { name: 'Heater' })).toBeDisabled();
      expect(screen.getByRole('slider', { name: 'Fan' })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Drum/ })).toBeEnabled();
      expect(screen.queryByRole('button', { name: /Cooling/ })).not.toBeInTheDocument();
      expect(screen.getByText('Heater and fan wait for Preheat')).toBeInTheDocument();
    });

    it('from Preheat the sliders are live', () => {
      renderApp(<RoastScreen onConnect={onConnect} />, { ...connected, roast: roast('preheat') });
      expect(screen.getByRole('slider', { name: 'Heater' })).toBeEnabled();
    });
  });

  it('Full control: everything is live, cooling switch included', async () => {
    const { api } = renderApp(<RoastScreen onConnect={onConnect} />, {
      ...connected,
      settings: { connection: null, controls: 'full' },
      readings: [reading({ cooling: 0 })],
    });
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /Cooling/ }));
    expect(api.setOutput).toHaveBeenCalledWith({ channel: 'cooling', value: 100 });
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
    /** A drag: sets the input's value the way the browser does, then fires input. */
    const slide = (input: HTMLElement, value: string) => {
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          input,
          value,
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
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
      // A change event, as a drag fires.
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          heater,
          '70',
        );
        heater.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(api.setOutput).toHaveBeenCalledWith({ channel: 'heater', value: 70 });
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
