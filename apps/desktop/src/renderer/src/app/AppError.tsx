import type { LogsApi, RoastpilotApi } from '@roastpilot/shared';
import { Button, ErrorState } from '@roastpilot/ui';
import { OctagonX } from 'lucide-react';
import { serializeError, type Logger } from '@roastpilot/core';
import { errorMessage } from '../lib/error-message';

/**
 * The whole window, when the app frame itself failed to draw. It takes what it needs as props,
 * not from context, so nothing above it has to work. Emergency stop stays, as the top bar is gone.
 */
export function AppError({
  error,
  connected,
  api,
  logger,
}: {
  error: unknown;
  connected: boolean;
  api: Pick<RoastpilotApi, 'emergencyStop'> & Pick<LogsApi, 'openLogFolder'>;
  logger: Logger;
}) {
  const run = (event: string, action: () => Promise<unknown>) => {
    action().catch((failure: unknown) => {
      logger.error(event, { error: serializeError(failure) });
    });
  };
  return (
    <div className="flex h-screen items-center bg-bg font-sans text-ink">
      <ErrorState
        title="Roastpilot hit a problem"
        detail={errorMessage(error)}
        before={
          connected ? (
            <Button
              variant="danger"
              icon={<OctagonX aria-hidden="true" />}
              onClick={() => {
                run('emergency-stop.failed', () => api.emergencyStop());
              }}
            >
              Emergency stop
            </Button>
          ) : null
        }
        onReload={() => {
          window.location.reload();
        }}
        onOpenLogs={() => {
          run('logs.open-folder-failed', () => api.openLogFolder());
        }}
      />
    </div>
  );
}
