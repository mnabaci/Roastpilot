import { DEFAULT_SETTINGS, DEFAULT_SOUNDS, type Sounds } from '@roastpilot/shared';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render-app';
import { SoundsSection } from './SoundsSection';

/** In the order they happen in a roast; Auto stopped last, as it can happen at any point. */
const STEPS = ['Charge soon', 'Beans in', 'Listen for first crack', 'Dump beans', 'Auto stopped'];

function setup(sounds: Sounds = DEFAULT_SOUNDS) {
  return renderApp(<SoundsSection />, { settings: { ...DEFAULT_SETTINGS, sounds } });
}

const row = (step: string) => within(screen.getByRole('group', { name: step }));

describe('SoundsSection', () => {
  it('shows a row per step, in roast order, with its voice, repeat and volume while Sounds is on', () => {
    setup();
    expect(screen.getByRole('switch', { name: 'Sounds' })).toBeChecked();
    for (const step of STEPS) expect(screen.getByRole('group', { name: step })).toBeVisible();
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(STEPS);
    expect(row('Charge soon').getByRole('button', { name: 'Repeat' })).toHaveTextContent(
      'Until done',
    );
    expect(row('Dump beans').getByRole('button', { name: 'Repeat' })).toHaveTextContent('2 times');
    expect(row('Auto stopped').getByRole('button', { name: 'Repeat' })).toHaveTextContent(
      '3 times',
    );
    expect(row('Charge soon').getByRole('button', { name: 'Voice' })).toHaveTextContent('Chime');
    expect(row('Listen for first crack').getByRole('button', { name: 'Voice' })).toHaveTextContent(
      'Ping',
    );
    expect(row('Auto stopped').getByRole('slider', { name: 'Volume' })).toHaveValue('90');
    // Every row is at its default: nothing to reset.
    expect(screen.queryByRole('button', { name: /^Reset/ })).toBeNull();
  });

  it('hides the steps when Sounds is turned off, and saves it', async () => {
    const { api, stores } = setup();
    await userEvent.click(screen.getByRole('switch', { name: 'Sounds' }));
    expect(screen.queryByRole('group', { name: 'Charge soon' })).toBeNull();
    expect(stores.settings.getState().settings.sounds.enabled).toBe(false);
    expect(api.setSettings.mock.lastCall?.[0].sounds.enabled).toBe(false);
  });

  it('saves a new voice for one step', async () => {
    const { api, stores } = setup();
    await userEvent.click(row('Beans in').getByRole('button', { name: 'Voice' }));
    await userEvent.click(screen.getByRole('option', { name: 'Bell' }));
    const { steps } = stores.settings.getState().settings.sounds;
    expect(steps['beans-in']).toEqual({ voice: 'bell', volumePct: 80, repeat: 'until-done' });
    expect(steps['charge-soon']).toEqual(DEFAULT_SOUNDS.steps['charge-soon']);
    expect(api.setSettings.mock.lastCall?.[0].sounds.steps['beans-in']).toEqual({
      voice: 'bell',
      volumePct: 80,
      repeat: 'until-done',
    });
  });

  it('saves a new repeat for one step', async () => {
    const { api, stores } = setup();
    await userEvent.click(row('Listen for first crack').getByRole('button', { name: 'Repeat' }));
    await userEvent.click(screen.getByRole('option', { name: '3 times' }));
    const { steps } = stores.settings.getState().settings.sounds;
    expect(steps['listen-first-crack']).toEqual({ voice: 'ping', volumePct: 70, repeat: 'thrice' });
    expect(steps['dump-beans']).toEqual(DEFAULT_SOUNDS.steps['dump-beans']);
    expect(api.setSettings.mock.lastCall?.[0].sounds.steps['listen-first-crack'].repeat).toBe(
      'thrice',
    );
    expect(
      row('Listen for first crack').getByRole('button', {
        name: 'Reset Listen for first crack to default',
      }),
    ).toBeVisible();
  });

  it('saves the volume once you let go of the slider', () => {
    const { stores } = setup();
    const volume = row('Dump beans').getByRole('slider', { name: 'Volume' });
    fireEvent.change(volume, { target: { value: '45' } });
    fireEvent.blur(volume);
    expect(stores.settings.getState().settings.sounds.steps['dump-beans']).toEqual({
      voice: 'chime',
      volumePct: 45,
      repeat: 'twice',
    });
  });

  it('Play previews the step as chosen, at its volume', async () => {
    const { chime } = setup({
      ...DEFAULT_SOUNDS,
      steps: {
        ...DEFAULT_SOUNDS.steps,
        'auto-stopped': { voice: 'beep', volumePct: 60, repeat: 'thrice' },
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Play Auto stopped' }));
    expect(chime.play).toHaveBeenCalledExactlyOnceWith('beep', 60);
  });

  describe('Play repeats as set', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('3 times plays three times, a brief pause apart, showing Stop until the last', () => {
      vi.useFakeTimers();
      const { chime } = setup();
      fireEvent.click(screen.getByRole('button', { name: 'Play Auto stopped' }));
      expect(chime.play).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Stop Auto stopped' })).toBeVisible();
      act(() => {
        vi.advanceTimersByTime(2_000);
      });
      expect(chime.play).toHaveBeenCalledTimes(3);
      expect(screen.getByRole('button', { name: 'Play Auto stopped' })).toBeVisible();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('Stop cancels the plays still to come', () => {
      vi.useFakeTimers();
      const { chime } = setup();
      fireEvent.click(screen.getByRole('button', { name: 'Play Charge soon' }));
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Stop Charge soon' }));
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(chime.play).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Play Charge soon' })).toBeVisible();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops when the step changes or Settings closes', () => {
      vi.useFakeTimers();
      const { chime, unmount } = setup();
      fireEvent.click(screen.getByRole('button', { name: 'Play Charge soon' }));
      const volume = row('Charge soon').getByRole('slider', { name: 'Volume' });
      fireEvent.change(volume, { target: { value: '45' } });
      fireEvent.blur(volume);
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(chime.play).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Play Dump beans' }));
      unmount();
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(chime.play).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('Reset brings a changed step back to its default, repeat too, and goes away', async () => {
    const { stores } = setup({
      ...DEFAULT_SOUNDS,
      steps: {
        ...DEFAULT_SOUNDS.steps,
        'listen-first-crack': { voice: 'none', volumePct: 20, repeat: 'until-done' },
      },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset Listen for first crack to default' }),
    );
    expect(stores.settings.getState().settings.sounds.steps['listen-first-crack']).toEqual({
      voice: 'ping',
      volumePct: 70,
      repeat: 'once',
    });
    expect(screen.queryByRole('button', { name: /^Reset/ })).toBeNull();
  });
});
