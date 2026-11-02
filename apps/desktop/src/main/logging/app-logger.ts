import { createLogger, fanOut, withMinLevel, type Logger, type LogSink } from '@roastpilot/core';
import { FileLogSink } from './file-log-sink';
import { terminalLogSink } from './terminal-log-sink';

export interface AppLogger {
  logger: Logger;
  /** Flushes the file before quit or exit. */
  flush: () => Promise<void>;
}

/** Registers the log sinks for this run (docs/spec/errors-and-logging.md). */
export function createAppLogger({ dir, dev }: { dir: string; dev: boolean }): AppLogger {
  // Last resort when a sink itself fails: there is no logger left to tell.
  const reportSinkError = (error: unknown) => {
    process.stderr.write(`Roastpilot log sink failed: ${String(error)}\n`);
  };
  const file = new FileLogSink({ dir, onError: reportSinkError });
  const sinks: LogSink[] = [withMinLevel(file, dev ? 'debug' : 'info')];
  if (dev) sinks.push(withMinLevel(terminalLogSink(), 'warn'));
  return { logger: createLogger(fanOut(sinks, reportSinkError), 'app'), flush: () => file.flush() };
}
