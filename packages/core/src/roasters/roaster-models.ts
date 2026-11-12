import {
  DRUM_SPEED,
  err,
  ok,
  type ConnectError,
  type ConnectTarget,
  type Result,
  type Roaster,
  type RoasterModel,
} from '@roastpilot/shared';
import type { RoasterDriver } from '../roaster-driver';
import type { DriverDeps, RoasterModelDefinition } from './roaster-model-definition';

/** An id no registered model has: a record or file from a newer app. */
export interface UnknownModelError {
  kind: 'unknown-model';
  model: string;
}

/** The roaster models the app knows, filled at startup (ADR 0024). */
export interface RoasterModels {
  readonly all: readonly RoasterModelDefinition[];
  /** A known model's definition. */
  get(model: RoasterModel): RoasterModelDefinition;
  /** Any id, such as one read from outside. */
  find(model: string): Result<RoasterModelDefinition, UnknownModelError>;
}

/** Every model id with its definition, so a missing one is a compile error. */
export type RoasterModelMap = {
  readonly [M in RoasterModel]: RoasterModelDefinition & { readonly id: M };
};

export function roasterModels(definitions: RoasterModelMap): RoasterModels {
  const byId = new Map<string, RoasterModelDefinition>(Object.entries(definitions));
  return {
    all: Object.values(definitions),
    get: (model) => definitions[model],
    find: (model) => {
      const found = byId.get(model);
      return found ? ok(found) : err({ kind: 'unknown-model', model });
    },
  };
}

/**
 * The driver of the roaster's model for this target (docs/spec/architecture.md, Device layer).
 * A target the model doesn't use is refused, never served by another model's driver.
 */
export function createDriver(
  models: Pick<RoasterModels, 'get'>,
  roaster: Pick<Roaster, 'model'>,
  target: ConnectTarget,
  deps: DriverDeps,
): Result<RoasterDriver, ConnectError> {
  const model = models.get(roaster.model);
  if (target.kind !== model.connection) {
    deps.logger.warn('driver.wrong-connection', {
      model: model.id,
      expected: model.connection,
      target: target.kind,
    });
    return err({ kind: 'wrong-connection', model: model.id, expected: model.connection });
  }
  return ok(model.createDriver(target, deps));
}

/** A new record of a model, with its starting values (docs/spec/roasters.md). */
export function newRoaster(name: string, model: RoasterModelDefinition): Omit<Roaster, 'id'> {
  const { batch, limits } = model;
  return {
    name,
    model: model.id,
    connection: model.connection === 'simulator' ? { kind: 'simulator' } : null,
    batchMinG: batch.minG,
    batchIdealG: batch.idealG,
    batchMaxG: batch.maxG,
    maxTempC: limits.maxTempC,
    maxTimeS: limits.maxTimeS,
    tempOffsetC: 0,
    tuning: model.tuning,
    coolerHelpsDrum: model.coolerHelpsDrum,
    drumSpeedPct: DRUM_SPEED.defaultPct,
    active: false,
  };
}
