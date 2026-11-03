import type { LogEntry } from '@roastpilot/shared';
import type { LogSink } from './log-sink';

export type LogContext = Readonly<Record<string, unknown>>;

/** Injected like the Clock, so core stays pure (docs/spec/errors-and-logging.md). */
export interface Logger {
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext): void;
  /** The same output, every entry tagged with a narrower scope: `session` → `session.monitor`. */
  child(scope: string): Logger;
}

export function createLogger(sink: LogSink, scope: string): Logger {
  const write = (level: LogEntry['level']) => (event: string, context?: LogContext) => {
    sink.write(
      context ? { level, scope, event, context: { ...context } } : { level, scope, event },
    );
  };
  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    child: (child) => createLogger(sink, `${scope}.${child}`),
  };
}

/** For tests and components nobody gave a logger. */
export const silentLogger: Logger = createLogger({ write: () => undefined }, 'silent');
