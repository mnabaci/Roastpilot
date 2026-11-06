import type { Screen } from '@roastpilot/shared';
import { ErrorState } from '@roastpilot/ui';
import { useRun } from '../features/use-run';
import { errorMessage } from '../lib/error-message';
import { useDeps } from './app-context';
import { screenLabel } from './screen-label';

/** One screen failed to draw; the top bar and Emergency stop above it still work. */
export function ScreenError({ screen, error }: { screen: Screen; error: unknown }) {
  const { api } = useDeps();
  const run = useRun();
  return (
    <ErrorState
      title={`${screenLabel(screen)} hit a problem`}
      detail={errorMessage(error)}
      onReload={() => {
        window.location.reload();
      }}
      onOpenLogs={() => {
        run('logs.open-folder-failed', () => api.openLogFolder());
      }}
    />
  );
}
