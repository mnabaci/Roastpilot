import type { ConnectionState } from '@roastpilot/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ACCEPTED_SETTINGS, CONNECTED, renderApp } from '../../test/render-app';
import { onConnect, reading, roast } from '../../test/roast-screen';
import { RoastScreen } from './RoastScreen';

/** A roaster with an ET probe, as the Simulator and a wired generic TC4 are. */
const TARGET = { kind: 'serial', path: '/dev/cu.usbserial-0001' } as const;
const WITH_ET: ConnectionState = {
  status: 'connected',
  target: TARGET,
  channels: [
    { id: 'bt', kind: 'sensor', unit: 'celsius', name: 'Temperature', short: 'Temp' },
    { id: 'et', kind: 'sensor', unit: 'celsius', name: 'Environment temperature', short: 'ET' },
    { id: 'heater', kind: 'output', unit: 'percent', min: 0, max: 100, step: 5 },
    { id: 'fan', kind: 'output', unit: 'percent', min: 0, max: 100, step: 5 },
  ],
};
const READINGS = [reading({ bt: 200, et: 212.4, heater: 50, fan: 30 })];
const tempCard = () => screen.getByRole('region', { name: 'Temperature' });

describe('RoastScreen with an ET probe', () => {
  it('shows ET beside the temperature', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      connection: WITH_ET,
      roast: roast('preheat'),
      readings: READINGS,
    });
    expect(within(tempCard()).getByText('ET')).toBeInTheDocument();
    expect(within(tempCard()).getByText('212.4')).toBeInTheDocument();
  });

  it('shows ET in °F when temperatures are in °F', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      connection: WITH_ET,
      roast: roast('preheat'),
      readings: READINGS,
      settings: { ...ACCEPTED_SETTINGS, temperatureUnit: 'f' },
    });
    // 212.4 °C is 414.3 °F, shown whole like every °F temperature.
    expect(within(tempCard()).getByText('414')).toBeInTheDocument();
  });

  it('has no ET on a roaster without an ET probe, even if a reading carries one', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      connection: CONNECTED,
      roast: roast('preheat'),
      readings: READINGS,
    });
    expect(within(tempCard()).queryByText('ET')).toBeNull();
  });

  it('has no ET while the roaster is lost', () => {
    renderApp(<RoastScreen onConnect={onConnect} />, {
      connection: { status: 'lost', target: TARGET },
      roast: roast('roasting'),
      readings: READINGS,
    });
    expect(within(tempCard()).queryByText('ET')).toBeNull();
  });
});
