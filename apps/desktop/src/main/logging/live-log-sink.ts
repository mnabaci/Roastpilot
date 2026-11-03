import type { LogSink } from '@roastpilot/core';
import type { LogEntry, LogRecord } from '@roastpilot/shared';

export interface LiveLogSinkOptions {
  /** Sends a batch to the windows. */
  publish: (records: LogRecord[]) => void;
  /** Runs `flush` later, off the caller's stack (setImmediate in the app). */
  schedule: (flush: () => void) => void;
  now?: () => Date;
  /** A failed send; must not log, or it would loop back here. */
  onError: (error: unknown) => void;
}

/**
 * Sends new entries to the log viewer (docs/spec/errors-and-logging.md, Viewer). `write` only
 * queues; everything written in one tick goes out as one batch.
 */
export function liveLogSink({
  publish,
  schedule,
  now = () => new Date(),
  onError,
}: LiveLogSinkOptions): LogSink {
  let queue: LogRecord[] = [];
  const flush = () => {
    const batch = queue;
    queue = [];
    try {
      publish(batch);
    } catch (error) {
      onError(error);
    }
  };
  return {
    write: (entry: LogEntry) => {
      if (queue.length === 0) schedule(flush);
      queue.push({ time: now().toISOString(), ...entry });
    },
  };
}
