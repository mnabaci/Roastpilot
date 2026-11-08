import { err } from '@roastpilot/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ACCEPTED_SETTINGS, fakeApi, renderApp } from '../../test/render-app';
import { SettingsScreen } from './SettingsScreen';
import type { SettingsSection } from './settings-section';

/** Holds the open section the way the app shell does. */
function Settings({ first = 'controls' }: { first?: SettingsSection }) {
  const [section, setSection] = useState<SettingsSection>(first);
  return <SettingsScreen section={section} onSection={setSection} />;
}

/** The option named `option` in the setting named `setting`. */
const radio = (option: string, setting: string) =>
  within(screen.getByRole('radiogroup', { name: setting })).getByRole('radio', { name: option });

describe('SettingsScreen', () => {
  it('lists the sections in the sidebar and shows only the open one', async () => {
    renderApp(<Settings />);
    const sections = screen.getByRole('list', { name: 'Sections' });
    expect(
      within(sections)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Controls', 'Roast', 'Sounds', 'Chart', 'Appearance', 'About']);
    expect(within(sections).getByRole('button', { name: 'Controls' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.queryByRole('switch', { name: 'Find the charge point' })).toBeNull();
    await userEvent.click(within(sections).getByRole('button', { name: 'Roast' }));
    expect(screen.getByRole('switch', { name: 'Find the charge point' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Controls' })).toBeNull();
  });

  it('roast settings: charge point, bean cooling time and drum cooling', async () => {
    const { api, stores } = renderApp(<Settings first="roast" />);
    expect(screen.getByRole('switch', { name: 'Find the charge point' })).toBeChecked();
    expect(radio('4 min', 'Cool the beans for')).toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: 'Find the charge point' }));
    await userEvent.click(radio('6 min', 'Cool the beans for'));
    await userEvent.click(screen.getByRole('switch', { name: 'Cool the drum after each roast' }));
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

  it('coaches manual roasts until you turn it off', async () => {
    const { api } = renderApp(<Settings first="roast" />);
    const coach = screen.getByRole('switch', { name: 'Coach in manual roasts' });
    expect(coach).toBeChecked();
    await userEvent.click(coach);
    expect(api.setSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ coachInManual: false }),
    );
  });

  it('hides Cool the drum to while drum cooling is off', async () => {
    renderApp(<Settings first="roast" />);
    expect(screen.getByRole('radiogroup', { name: 'Cool the drum to' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Cool the drum after each roast' }));
    expect(screen.queryByRole('radiogroup', { name: 'Cool the drum to' })).toBeNull();
  });

  it('the beans cool by time only; the drum cools to its own target', async () => {
    const { api, stores } = renderApp(<Settings first="roast" />);
    expect(screen.queryByRole('radiogroup', { name: 'Cooling ends' })).toBeNull();
    await userEvent.click(radio('60 °C', 'Cool the drum to'));
    expect(stores.settings.getState().settings.roasterCoolToC).toBe(60);
    expect(api.setSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ roasterCoolToC: 60 }),
    );
  });

  it('switches between Guided and Full control', async () => {
    const { api, stores } = renderApp(<Settings />);
    expect(radio('Guided', 'Controls')).toBeChecked();
    expect(screen.getByText(/fan and cooling locked while the beans cool/)).toBeInTheDocument();
    await userEvent.click(radio('Full control', 'Controls'));
    expect(screen.getByText(/any time the roaster is connected/)).toBeInTheDocument();
    expect(stores.settings.getState().settings.controls).toBe('full');
    expect(api.setSettings).toHaveBeenCalledWith({
      ...ACCEPTED_SETTINGS,
      connection: null,
      controls: 'full',
      chartSmoothingS: 3,
    });
  });

  it('picks how much the temperature line is smoothed', async () => {
    const { api, stores } = renderApp(<Settings first="chart" />);
    expect(radio('3 s', 'Temperature smoothing')).toBeChecked();
    await userEvent.click(radio('Off', 'Temperature smoothing'));
    expect(stores.settings.getState().settings.chartSmoothingS).toBe(0);
    expect(api.setSettings).toHaveBeenCalledWith(expect.objectContaining({ chartSmoothingS: 0 }));
  });

  it('switches each chart aid during a roast, all on until you choose, each with its hint', async () => {
    const { api, stores } = renderApp(<Settings first="chart" />);
    const card = screen.getByRole('region', { name: 'During a roast' });
    for (const [name, hint] of [
      ['Projection', 'Where the temperature is heading at this RoR'],
      ['Now line', 'A line at the current time'],
      ['Temperature focus', 'Temperature axis fitted to the roast'],
      ['Phase bands', 'Drying, Maillard and development behind the curve'],
    ] as const) {
      expect(within(card).getByRole('switch', { name })).toHaveAttribute('aria-checked', 'true');
      expect(within(card).getByText(hint)).toBeInTheDocument();
    }
    await userEvent.click(within(card).getByRole('switch', { name: 'Phase bands' }));
    expect(stores.settings.getState().settings.chartPhaseBands).toBe(false);
    expect(api.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ chartPhaseBands: false, chartProjection: true }),
    );
  });

  it('picks the theme: Dark until you choose', async () => {
    const { api, stores } = renderApp(<Settings first="appearance" />);
    expect(radio('Dark', 'Theme')).toBeChecked();
    await userEvent.click(radio('Match system', 'Theme'));
    expect(stores.settings.getState().settings.theme).toBe('system');
    expect(api.setSettings).toHaveBeenCalledWith(expect.objectContaining({ theme: 'system' }));
  });

  it('keeps the change for this session when saving fails', async () => {
    const api = fakeApi({
      setSettings: () => Promise.resolve(err({ kind: 'write-failed', message: 'disk full' })),
    });
    const { stores } = renderApp(<Settings />, {}, api);
    await userEvent.click(radio('Full control', 'Controls'));
    expect(stores.settings.getState().settings.controls).toBe('full');
  });
});
