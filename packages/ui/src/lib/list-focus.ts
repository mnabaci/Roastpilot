import type { KeyboardEvent } from 'react';

const STEP: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

/** In a list of button rows, Up and Down move focus to the row before or after; the ends stay put. */
export function moveFocusInList(event: KeyboardEvent<HTMLButtonElement>): void {
  const step = STEP[event.key];
  const list = event.currentTarget.closest('ul');
  if (step === undefined || !list) return;
  const rows = [...list.querySelectorAll('button')];
  const at = rows.indexOf(event.currentTarget);
  const next = rows[at + step];
  if (at === -1 || !next) return;
  event.preventDefault();
  next.focus();
}
