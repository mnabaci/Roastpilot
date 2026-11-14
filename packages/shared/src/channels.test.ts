import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMP_NAMES, optionalSensorNames, sensorNames, type Channel } from './channels';

const CHANNELS: Channel[] = [
  { id: 'bt', kind: 'sensor', unit: 'celsius', name: 'Bean temperature', short: 'BT' },
  { id: 'et', kind: 'sensor', unit: 'celsius', name: 'Environment temperature', short: 'ET' },
  { id: 'heater', kind: 'output', unit: 'percent', min: 0, max: 100, step: 5 },
];

describe('sensorNames', () => {
  it('uses the names the roaster gives each sensor', () => {
    expect(sensorNames(CHANNELS, 'bt')).toEqual({ name: 'Bean temperature', short: 'BT' });
    expect(sensorNames(CHANNELS, 'et')).toEqual({ name: 'Environment temperature', short: 'ET' });
  });

  it('falls back to the neutral names for an unknown sensor or a non-sensor', () => {
    expect(sensorNames([], 'bt')).toEqual(DEFAULT_TEMP_NAMES);
    expect(sensorNames(CHANNELS, 'heater')).toEqual(DEFAULT_TEMP_NAMES);
  });
});

describe('optionalSensorNames', () => {
  it("gives a sensor's names, or nothing when the roaster has no such sensor", () => {
    expect(optionalSensorNames(CHANNELS, 'et')).toEqual({
      name: 'Environment temperature',
      short: 'ET',
    });
    expect(optionalSensorNames(CHANNELS.slice(0, 1), 'et')).toBeUndefined();
    expect(optionalSensorNames(CHANNELS, 'heater')).toBeUndefined();
  });
});
