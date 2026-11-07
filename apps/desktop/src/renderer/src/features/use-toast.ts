import type { ToastKind } from '@roastpilot/ui';
import { useCallback } from 'react';
import { useDeps } from '../app/app-context';
import { addToast } from '../stores/toasts-store';

/**
 * Shows a one-line toast (docs/spec/ui.md, Toasts): for an action whose failure the screen
 * doesn't show inline. Never for safety, which stays in the banners.
 */
export function useToast(): (kind: ToastKind, text: string) => void {
  const { stores } = useDeps();
  return useCallback(
    (kind, text) => {
      stores.toasts.setState((data) => addToast(data, kind, text));
    },
    [stores],
  );
}
