import type {
  AutoProfile,
  AutoTuning,
  Channel,
  ConnectTarget,
  RoasterModel,
  RoasterModelFacts,
} from '@roastpilot/shared';
import type { Clock } from '../clock';
import type { Logger } from '../logging/logger';
import type { RoasterDriver } from '../roaster-driver';

/** What a model's driver is built with, besides its target. */
export interface DriverDeps {
  clock: Clock;
  logger: Logger;
}

/**
 * Everything about one roaster model (ADR 0024, docs/spec/extensibility.md): implemented once per
 * model in `drivers`, registered at startup. Its facts are its `ROASTER_MODEL_FACTS` entry.
 */
export interface RoasterModelDefinition extends RoasterModelFacts {
  readonly id: RoasterModel;
  /** What its driver reads and controls, known without connecting. */
  readonly channels: readonly Channel[];
  /** The profiles it ships with. */
  readonly profiles: readonly AutoProfile[];
  /** A new record's starting values. */
  readonly tuning: AutoTuning;
  readonly batch: { readonly minG: number; readonly idealG: number; readonly maxG: number };
  /** The tray fan sits under the drum and helps cool it (docs/spec/roasters.md). */
  readonly coolerHelpsDrum: boolean;
  /**
   * Its driver for a target of its `connection` kind. Called only with that kind (`createDriver`
   * checks it first): another kind is a programmer error and throws.
   */
  createDriver(target: ConnectTarget, deps: DriverDeps): RoasterDriver;
}
