import type { Screen } from '@roastpilot/shared';
import { Toaster } from '@roastpilot/ui';
import { useStore } from 'zustand';
import { removeToast } from '../stores/toasts-store';
import { useDeps } from './app-context';

/**
 * The window's toasts, bottom-right. On Roast they sit left of the side panel (its p-6 + w-80 +
 * gap-6 = right-92), over the chart, so the flow buttons and sliders are never covered.
 */
export function AppToaster({ screen }: { screen: Screen }) {
  const { stores } = useDeps();
  const toasts = useStore(stores.toasts, (s) => s.toasts);
  return (
    <Toaster
      toasts={toasts}
      onDismiss={(id) => {
        stores.toasts.setState((data) => removeToast(data, id));
      }}
      className={screen === 'roast' ? 'right-92' : undefined}
    />
  );
}
