import type { NotedField, NotedValues } from '@roastpilot/core';
import type { Bean } from '@roastpilot/shared';
import { createContext, useContext } from 'react';

/** Opens the Roasting cheat sheet at a field, marking a bean's own rows. */
export type OpenGuide = (start?: NotedField, values?: NotedValues) => void;

/** Given by the Beans screen, so a field's ⓘ can open the cheat sheet; none elsewhere. */
export const RoastingGuideContext = createContext<OpenGuide | undefined>(undefined);

export const useOpenGuide = (): OpenGuide | undefined => useContext(RoastingGuideContext);

/** A saved bean's values, as the cheat sheet marks them. */
export const notedOf = (bean: Bean): NotedValues => ({
  process: bean.process,
  species: bean.species,
  altitudeM: bean.altitudeM,
  densityGL: bean.densityGL,
  moisturePct: bean.moisturePct,
  screen: bean.screen,
  decaf: bean.decaf,
});
