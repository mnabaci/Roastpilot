import { roasterModels } from '@roastpilot/core';
import { simulatorModel, skywalkerModel, tc4Model } from '@roastpilot/drivers';

/**
 * Every roaster model the app knows, registered at startup (ADR 0024, docs/spec/extensibility.md,
 * Roaster models): new models go here. tsc fails while a model id has no definition.
 */
export const ROASTER_MODELS = roasterModels({
  skywalker: skywalkerModel,
  tc4: tc4Model,
  simulator: simulatorModel,
});
