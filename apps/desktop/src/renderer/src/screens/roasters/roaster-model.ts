import type { RoasterModel } from '@roastpilot/shared';

/** How each roaster model is named on screen. */
export const MODEL_LABEL: Readonly<Record<RoasterModel, string>> = {
  skywalker: 'Skywalker',
  simulator: 'Simulator',
};

/** The model, when the name doesn't already say it ("Skywalker" named Skywalker needs no second line). */
export const modelNote = (roaster: { name: string; model: RoasterModel }): string | undefined =>
  roaster.name === MODEL_LABEL[roaster.model] ? undefined : MODEL_LABEL[roaster.model];
