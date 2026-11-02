import type { LogSink } from '@roastpilot/core';

/** Dev only: prints entries to the terminal. Deferred with setImmediate so the caller never waits. */
export function terminalLogSink(out: Pick<NodeJS.WriteStream, 'write'> = process.stderr): LogSink {
  return {
    write: (entry) => {
      setImmediate(() => {
        const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
        out.write(`[${entry.level}] ${entry.scope} ${entry.event}${context}\n`);
      });
    },
  };
}
