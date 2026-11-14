import type { Bean } from '@roastpilot/shared';
import { formatGrams } from './batch-format';
import type { BeanDraft } from './bean-draft';

/** What helps you pick a bean: its green stock, origin and process ("300 g · Ethiopia · washed"). */
export const beanDetail = (bean: Bean): string =>
  `${formatGrams(bean.greenG)} · ${bean.origin} · ${bean.process}`;

/** `greencoffeecollective.com` for a link to any page of it. */
export function siteOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The folded line: where it's from and how it was made, then the shop. */
export function aboutSummary(draft: BeanDraft): string {
  const t = (value: string) => value.trim();
  return [
    t(draft.origin),
    capital(draft.process),
    t(draft.variety),
    t(draft.altitudeM) ? `${t(draft.altitudeM)} m` : '',
    t(draft.supplier) || (t(draft.link) ? siteOf(t(draft.link)) : ''),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Tasting notes written as a list ("Dark chocolate | Pecan, Plum") as separate notes. */
export const tastingNotes = (notes: string): string[] =>
  notes.includes('|') || notes.includes(',')
    ? notes
        .split(/[|,]/)
        .map((n) => n.trim())
        .filter(Boolean)
    : [];
