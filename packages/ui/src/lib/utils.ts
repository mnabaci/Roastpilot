import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import tokens from '../../tokens.json';

/**
 * Our type styles (text-readout-xl, text-body, ...) are font sizes, but tailwind-merge would
 * read them as colours and drop them next to text-ink. Register them as font sizes.
 */
const typeStyleNames = tokens.type.groups.flatMap((group) => group.styles.map((s) => s.name));

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: { 'font-size': [{ text: typeStyleNames }] },
  },
});

/** Merge class names, letting later Tailwind classes win (shadcn/ui convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
