import {
  createDriver as createModelDriver,
  type DriverDeps,
  type RoasterDriver,
} from '@roastpilot/core';
import type { ConnectError, ConnectTarget, Result, Roaster } from '@roastpilot/shared';
import { ROASTER_MODELS } from './roaster-models';

/** Builds the driver of the roaster's model for what the user picked (ADR 0024). */
export function createDriver(
  roaster: Pick<Roaster, 'model'>,
  target: ConnectTarget,
  deps: DriverDeps,
): Result<RoasterDriver, ConnectError> {
  return createModelDriver(ROASTER_MODELS, roaster, target, deps);
}
