import { DEFAULT_TEMP_NAMES, sensorNames, type SensorNames } from '@roastpilot/shared';
import { useConnection } from '../stores/use-stores';

/**
 * What the connected roaster calls sensor `id` (docs/spec/extensibility.md, Sensor names); the
 * neutral names when no roaster is connected.
 */
export function useSensorNames(id = 'bt'): SensorNames {
  const channels = useConnection((s) =>
    s.connection.status === 'connected' ? s.connection.channels : undefined,
  );
  return channels ? sensorNames(channels, id) : DEFAULT_TEMP_NAMES;
}
