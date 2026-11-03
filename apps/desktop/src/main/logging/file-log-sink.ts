import type { LogSink } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { formatLogLine } from './format-log-line';

/** `roastpilot-2026-11-03.log`; the day is group 1. */
export const LOG_FILE_PATTERN = /^roastpilot-(\d{4}-\d{2}-\d{2})\.log$/;

export const logFileName = (day: string): string => `roastpilot-${day}.log`;

/** Local calendar day, so a file holds the user's day: `2026-11-02`. */
export function logDay(time: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(time.getFullYear())}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`;
}

export interface FileLogSinkOptions {
  dir: string;
  now?: () => Date;
  /** Called when the disk write fails; a failing log must never throw into the caller. */
  onError: (error: unknown) => void;
}

/**
 * Appends JSON lines to `roastpilot-YYYY-MM-DD.log` through a buffered stream: `write` only queues
 * and returns, so logging never blocks the roaster loop (docs/spec/errors-and-logging.md).
 */
export class FileLogSink implements LogSink {
  readonly #dir: string;
  readonly #now: () => Date;
  readonly #onError: (error: unknown) => void;
  #stream: WriteStream | undefined;
  #day: string | undefined;

  constructor(options: FileLogSinkOptions) {
    this.#dir = options.dir;
    this.#now = options.now ?? (() => new Date());
    this.#onError = options.onError;
    mkdirSync(this.#dir, { recursive: true });
  }

  write(entry: LogEntry): void {
    const time = this.#now();
    this.#streamFor(logDay(time)).write(formatLogLine(entry, time));
  }

  /** Waits until everything written so far is on disk. Call before quit or exit. */
  flush(): Promise<void> {
    const stream = this.#stream;
    this.#stream = undefined;
    this.#day = undefined;
    if (!stream) return Promise.resolve();
    return new Promise((resolve) => {
      stream.end(resolve);
    });
  }

  #streamFor(day: string): WriteStream {
    if (this.#stream && this.#day === day) return this.#stream;
    this.#stream?.end();
    const stream = createWriteStream(join(this.#dir, logFileName(day)), { flags: 'a' });
    stream.on('error', this.#onError);
    this.#stream = stream;
    this.#day = day;
    return stream;
  }
}

/** Keeps today's file and the `keepDays - 1` days before; deletes older ones. Other files are left alone. */
export async function pruneOldLogs(dir: string, now: Date, keepDays: number): Promise<string[]> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - (keepDays - 1));
  const oldest = logDay(cutoff);
  const names = await readdir(dir);
  const old = names.filter((name) => {
    const day = LOG_FILE_PATTERN.exec(name)?.[1];
    return day !== undefined && day < oldest;
  });
  await Promise.all(old.map((name) => unlink(join(dir, name))));
  return old;
}
