import {
  createDriver as createModelDriver,
  FanInterlockDriver,
  type DriverDeps,
  type RoasterDriver,
} from '@roastpilot/core';
import {
  ok,
  type ConnectError,
  type ConnectTarget,
  type Result,
  type Roaster,
} from '@roastpilot/shared';
import { ROASTER_MODELS } from './roaster-models';

/**
 * Builds the driver of the roaster's model for what the user picked (ADR 0024), with the record's
 * wiring, behind its minimum fan while heating when it has one (docs/spec/safety.md). `onBuilt`
 * gets the model's own driver, before any wrapper, for what only it offers (reading every input).
 */
export function createDriver(
  roaster: Pick<Roaster, 'model' | 'wiring' | 'minFanHeatingPct'>,
  target: ConnectTarget,
  deps: DriverDeps,
  onBuilt: (driver: RoasterDriver) => void = () => undefined,
): Result<RoasterDriver, ConnectError> {
  const made = createModelDriver(ROASTER_MODELS, roaster, target, deps);
  if (!made.ok) return made;
  onBuilt(made.value);
  return ok(
    roaster.minFanHeatingPct > 0
      ? new FanInterlockDriver(
          made.value,
          roaster.minFanHeatingPct,
          deps.logger.child('fan-interlock'),
        )
      : made.value,
  );
}
