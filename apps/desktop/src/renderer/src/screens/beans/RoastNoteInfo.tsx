import { roastNote, type NotedValues } from '@roastpilot/core';
import { InfoButton } from '@roastpilot/ui';
import type { BeanDraftState } from './use-bean-draft';

type Draft = BeanDraftState['draft'];

/** A number the draft holds, or none while it's empty or not a number yet. */
const numberIn = (text: string): number | null => {
  const n = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

/** The draft's values a roast note speaks to, as the bean will have them. */
const notedValues = (draft: Draft): NotedValues => ({
  process: draft.process,
  species: draft.species === '' ? null : draft.species,
  altitudeM: numberIn(draft.altitudeM),
  densityGL: numberIn(draft.densityGL),
  moisturePct: numberIn(draft.moisturePct),
  screen: numberIn(draft.screen),
  decaf: draft.decaf,
});

/**
 * The ⓘ beside a bean's field: what its value means for roasting (docs/spec/
 * beans-favourites-ghost.md, Roast notes). None while the value has nothing to say.
 */
export function RoastNoteInfo({
  field,
  draft,
  label,
}: {
  field: keyof NotedValues;
  draft: Draft;
  /** The field's name, for the button's: "About Process". */
  label: string;
}) {
  const note = roastNote(field, notedValues(draft)[field]);
  return note ? <InfoButton label={`About ${label}`} lines={note} /> : null;
}
