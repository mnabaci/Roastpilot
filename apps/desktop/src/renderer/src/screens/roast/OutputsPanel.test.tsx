import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { err } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { addReading } from '../../stores/roast-store';
import { fakeApi, renderApp } from '../../test/render-app';
import { auto, connected, onConnect, reading, roast } from '../../test/roast-screen';
import { RoastScreen } from './RoastScreen';

describe('OutputsPanel', () => {
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

  describe('in Auto', () => {
    it('shows Auto on an output it drives, and Manual with Resume auto on one you took', async () => {
      const { api } = renderApp(
        <RoastScreen onConnect={onConnect} />,
        auto('roasting', { fan: 'manual', phaseName: 'Yellowing', nextPhaseAtC: 165 }),
      );
      expect(screen.getByText('Step: Yellowing · next at 165 °C')).toBeInTheDocument();
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
});
