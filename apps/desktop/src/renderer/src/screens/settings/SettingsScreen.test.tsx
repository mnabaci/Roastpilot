import { err, DEFAULT_SETTINGS } from '@roastpilot/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fakeApi, renderApp } from '../../test/render-app';
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
    ).toEqual(['Controls', 'Roast', 'Auto', 'Chart']);
    expect(within(sections).getByRole('button', { name: 'Controls' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.queryByRole('switch', { name: 'Find the charge point' })).toBeNull();
    await userEvent.click(within(sections).getByRole('button', { name: 'Roast' }));
    expect(screen.getByRole('switch', { name: 'Find the charge point' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Controls' })).toBeNull();
  });

  it('roast settings: charge point, cooling time and roaster cool-down', async () => {
    const { api, stores } = renderApp(<Settings first="roast" />);
    expect(screen.getByRole('switch', { name: 'Find the charge point' })).toBeChecked();
    expect(radio('4 min', 'Cooling time')).toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: 'Find the charge point' }));
    await userEvent.click(radio('6 min', 'Cooling time'));
    await userEvent.click(
      screen.getByRole('switch', { name: 'Cool the roaster after each roast' }),
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

  it('hides Cool the roaster to while the cool-down is off', async () => {
    renderApp(<Settings first="roast" />);
    expect(screen.getByRole('radiogroup', { name: 'Cool the roaster to' })).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('switch', { name: 'Cool the roaster after each roast' }),
    );
    expect(screen.queryByRole('radiogroup', { name: 'Cool the roaster to' })).toBeNull();
  });

  it('cooling ends by time or by temperature; the roaster cools to its own target', async () => {
    const { api, stores } = renderApp(<Settings first="roast" />);
    expect(screen.queryByRole('radiogroup', { name: 'Cool until below' })).toBeNull();
    await userEvent.click(radio('By temperature', 'Cooling ends'));
    expect(screen.queryByRole('radiogroup', { name: 'Cooling time' })).toBeNull();
    expect(radio('90 °C', 'Cool until below')).toBeChecked();
    await userEvent.click(radio('80 °C', 'Cool until below'));
    await userEvent.click(radio('60 °C', 'Cool the roaster to'));
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
    const { api, stores } = renderApp(<Settings />);
    expect(radio('Guided', 'Controls')).toBeChecked();
    expect(screen.getByText(/fan and cooling locked while the beans cool/)).toBeInTheDocument();
    await userEvent.click(radio('Full control', 'Controls'));
    expect(screen.getByText(/any time the roaster is connected/)).toBeInTheDocument();
    expect(stores.settings.getState().settings.controls).toBe('full');
    expect(api.setSettings).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      connection: null,
      controls: 'full',
      chartSmoothingS: 3,
    });
  });

  it('picks the soak time', async () => {
    const { stores } = renderApp(<Settings first="auto" />);
    expect(radio('1:00', 'Soak time')).toBeChecked();
    await userEvent.click(radio('1:30', 'Soak time'));
    expect(stores.settings.getState().settings.soakTimeS).toBe(90);
  });

  it('picks how much the temperature line is smoothed', async () => {
    const { api, stores } = renderApp(<Settings first="chart" />);
    expect(radio('3 s', 'Temperature smoothing')).toBeChecked();
    await userEvent.click(radio('Off', 'Temperature smoothing'));
    expect(stores.settings.getState().settings.chartSmoothingS).toBe(0);
    expect(api.setSettings).toHaveBeenCalledWith(expect.objectContaining({ chartSmoothingS: 0 }));
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
