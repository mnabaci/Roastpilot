import { DEFAULT_SETTINGS, DEFAULT_SOUNDS, type Sounds } from '@roastpilot/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render-app';
import { SoundsSection } from './SoundsSection';

const STEPS = ['Charge soon', 'Beans in', 'Dump beans', 'Listen for first crack', 'Auto stopped'];

function setup(sounds: Sounds = DEFAULT_SOUNDS) {
  return renderApp(<SoundsSection />, { settings: { ...DEFAULT_SETTINGS, sounds } });
}

const row = (step: string) => within(screen.getByRole('group', { name: step }));

describe('SoundsSection', () => {
  it('shows a row per step with its voice and volume while Sounds is on', () => {
    setup();
    expect(screen.getByRole('switch', { name: 'Sounds' })).toBeChecked();
    for (const step of STEPS) expect(screen.getByRole('group', { name: step })).toBeVisible();
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
    expect(steps['beans-in']).toEqual({ voice: 'bell', volumePct: 80 });
    expect(steps['charge-soon']).toEqual({ voice: 'chime', volumePct: 80 });
    expect(api.setSettings.mock.lastCall?.[0].sounds.steps['beans-in']).toEqual({
      voice: 'bell',
      volumePct: 80,
    });
  });

  it('saves the volume once you let go of the slider', () => {
    const { stores } = setup();
    const volume = row('Dump beans').getByRole('slider', { name: 'Volume' });
    fireEvent.change(volume, { target: { value: '45' } });
    fireEvent.blur(volume);
    expect(stores.settings.getState().settings.sounds.steps['dump-beans']).toEqual({
      voice: 'chime',
      volumePct: 45,
    });
  });

  it('Play previews the step as chosen, at its volume', async () => {
    const { chime } = setup({
      ...DEFAULT_SOUNDS,
      steps: { ...DEFAULT_SOUNDS.steps, 'auto-stopped': { voice: 'beep', volumePct: 60 } },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Play Auto stopped' }));
    expect(chime.play).toHaveBeenCalledExactlyOnceWith('beep', 60);
  });

  it('Reset brings a changed step back to its default and goes away', async () => {
    const { stores } = setup({
      ...DEFAULT_SOUNDS,
      steps: { ...DEFAULT_SOUNDS.steps, 'listen-first-crack': { voice: 'none', volumePct: 20 } },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset Listen for first crack to default' }),
    );
    expect(stores.settings.getState().settings.sounds.steps['listen-first-crack']).toEqual({
      voice: 'ping',
      volumePct: 70,
    });
    expect(screen.queryByRole('button', { name: /^Reset/ })).toBeNull();
  });
});
