import {
  LogDaySchema,
  LogRecordSchema,
  MAX_LOG_RECORDS,
  type LogDay,
  type LogDayRead,
  type LogRecord,
} from '@roastpilot/shared';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LOG_FILE_PATTERN, logFileName } from './file-log-sink';

const isMissing = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** Days that have a log file in `dir`, newest first. A missing folder has none. */
export async function listLogDays(dir: string): Promise<LogDay[]> {
  try {
    const names = await readdir(dir);
    return names
      .flatMap((name) => LOG_FILE_PATTERN.exec(name)?.[1] ?? [])
      .sort()
      .reverse();
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

function parseLine(line: string): LogRecord | undefined {
  try {
    const parsed = LogRecordSchema.safeParse(JSON.parse(line));
    return parsed.success ? parsed.data : undefined;
  } catch {
    // Not JSON (a line cut short by a crash, or not ours): counted as unreadable by the caller.
    return undefined;
  }
}

/** Turns a log file's text into its newest `max` records, counting the lines that aren't entries. */
export function parseLogText(text: string, max = MAX_LOG_RECORDS): LogDayRead {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const records: LogRecord[] = [];
  let unreadable = 0;
  for (const line of lines) {
    const record = parseLine(line);
    if (record) records.push(record);
    else unreadable++;
  }
  const truncated = records.length > max;
  return { records: truncated ? records.slice(-max) : records, unreadable, truncated };
}

/**
 * One day's log (docs/spec/errors-and-logging.md, Viewer). The day is validated first, so only
 * `roastpilot-YYYY-MM-DD.log` in `dir` can ever be read. A day without a file is empty.
 */
export async function readLogDay(dir: string, day: unknown): Promise<LogDayRead> {
  const valid = LogDaySchema.parse(day);
  try {
    return parseLogText(await readFile(join(dir, logFileName(valid)), 'utf8'));
  } catch (error) {
    if (isMissing(error)) return { records: [], unreadable: 0, truncated: false };
    throw error;
  }
}
