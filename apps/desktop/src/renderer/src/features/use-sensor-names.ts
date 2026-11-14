import {
  DEFAULT_TEMP_NAMES,
  optionalSensorNames,
  sensorNames,
  type Channel,
  type SensorNames,
} from '@roastpilot/shared';
import { useConnection } from '../stores/use-stores';

/**
 * What the connected roaster calls sensor `id` (docs/spec/extensibility.md, Sensor names); the
 * neutral names when no roaster is connected.
 */
export function useSensorNames(id = 'bt'): SensorNames {
  const channels = useConnectedChannels();
  return channels ? sensorNames(channels, id) : DEFAULT_TEMP_NAMES;
}

/**
 * The names of an optional sensor (ET) when the connected roaster has it; undefined otherwise, so
 * its card and line only show where there is one.
 */
export function useOptionalSensor(id: string): SensorNames | undefined {
  const channels = useConnectedChannels();
  return channels ? optionalSensorNames(channels, id) : undefined;
}

function useConnectedChannels(): readonly Channel[] | undefined {
  return useConnection((s) =>
    s.connection.status === 'connected' ? s.connection.channels : undefined,
  );
}
