import { modelFacts, type RoasterModel } from '@roastpilot/shared';

/** The model, when the name doesn't already say it ("Skywalker" named Skywalker needs no second line). */
export const modelNote = (roaster: { name: string; model: RoasterModel }): string | undefined => {
  const { label } = modelFacts(roaster.model);
  return roaster.name === label ? undefined : label;
};
