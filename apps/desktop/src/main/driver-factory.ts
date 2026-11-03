import type { Clock, Logger, RoasterDriver } from '@roastpilot/core';
import { SerialTransport, SimulatedDriver, Tc4SkywalkerDriver } from '@roastpilot/drivers';
import type { ConnectTarget } from '@roastpilot/shared';

/** Builds the driver for what the user picked: a serial port or the simulator. */
export function createDriver(target: ConnectTarget, clock: Clock, logger: Logger): RoasterDriver {
  if (target.kind === 'simulator') return new SimulatedDriver({ clock });
  const transport = new SerialTransport({ path: target.path, logger: logger.child('serial') });
  return new Tc4SkywalkerDriver({ transport, clock, logger: logger.child('tc4') });
}
