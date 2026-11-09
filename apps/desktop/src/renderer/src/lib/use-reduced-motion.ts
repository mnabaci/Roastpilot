import { useSyncExternalStore } from 'react';

const REDUCE = '(prefers-reduced-motion: reduce)';

/** The system's "reduce motion" query, or nothing where there is none (a test page). */
const query = (): MediaQueryList | undefined =>
  typeof window.matchMedia === 'function' ? window.matchMedia(REDUCE) : undefined;

function subscribe(changed: () => void): () => void {
  const media = query();
  media?.addEventListener('change', changed);
  return () => {
    media?.removeEventListener('change', changed);
  };
}

/** Whether the system asks for less motion; it follows the setting as it changes. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => query()?.matches ?? false);
}
