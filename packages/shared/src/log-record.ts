import { z } from 'zod';
import { LogLevelSchema } from './log-entry';

/** One line of a log file (docs/spec/errors-and-logging.md, Files): the entry plus when it was written. */
export const LogRecordSchema = z.object({
  /** ISO time. */
  time: z.string(),
  level: LogLevelSchema,
  scope: z.string(),
  event: z.string(),
  /** Usually an object; `'[unserializable]'` when the original couldn't be written. */
  context: z.unknown().optional(),
});

/** A log file's day. Checked before any file is opened, so it can only name a log file. */
export const LogDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** At most this many entries of one day are read, the newest. */
export const MAX_LOG_RECORDS = 2_000;

export const LogDayReadSchema = z.object({
  /** Oldest first, at most MAX_LOG_RECORDS. */
  records: z.array(LogRecordSchema),
  /** Lines that weren't a valid entry, skipped. */
  unreadable: z.number().int().nonnegative(),
  /** True when older entries were left out to stay within MAX_LOG_RECORDS. */
  truncated: z.boolean(),
});

export type LogRecord = z.infer<typeof LogRecordSchema>;
export type LogDay = z.infer<typeof LogDaySchema>;
export type LogDayRead = z.infer<typeof LogDayReadSchema>;
