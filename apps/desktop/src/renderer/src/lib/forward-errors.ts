import type { RoastpilotApi } from '@roastpilot/shared';

function describe(error: unknown): Record<string, unknown> {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { value: String(error) };
}

/** Sends every uncaught renderer error to main's log (docs/spec/errors-and-logging.md). */
export function forwardErrors(
  target: Pick<Window, 'addEventListener'>,
  api: Pick<RoastpilotApi, 'log'>,
): void {
  target.addEventListener('error', (event: ErrorEvent) => {
    api.log({
      level: 'error',
      event: 'renderer.uncaught-error',
      context: {
        ...describe(event.error ?? event.message),
        source: event.filename,
        line: event.lineno,
      },
    });
  });
  target.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    api.log({
      level: 'error',
      event: 'renderer.unhandled-rejection',
      context: describe(event.reason),
    });
  });
}
