import { LOG_LEVELS, type LogEntry, type LogLevel } from '@roastpilot/shared';

/** Where log entries go: a file, the terminal, later a remote service (docs/spec/extensibility.md). */
export interface LogSink {
  write(entry: LogEntry): void;
}

const rank = (level: LogLevel): number => LOG_LEVELS.indexOf(level);

/** Passes on only entries at `minLevel` or above. */
export function withMinLevel(sink: LogSink, minLevel: LogLevel): LogSink {
  return {
    write: (entry) => {
      if (rank(entry.level) >= rank(minLevel)) sink.write(entry);
    },
  };
}

/** Writes every entry to every sink; one failing sink never stops the others. */
export function fanOut(sinks: readonly LogSink[], onSinkError: (error: unknown) => void): LogSink {
  return {
    write: (entry) => {
      for (const sink of sinks) {
        try {
          sink.write(entry);
        } catch (error) {
          onSinkError(error);
        }
      }
    },
  };
}
