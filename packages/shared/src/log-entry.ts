import { z } from 'zod';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export const LogLevelSchema = z.enum(LOG_LEVELS);

/** One thing that happened (docs/spec/errors-and-logging.md). Crosses IPC from the renderer, so it is a schema. */
export const LogEntrySchema = z.object({
  level: LogLevelSchema,
  /** Where it happened: `session`, `driver.tc4`, `renderer`, ... */
  scope: z.string().min(1),
  /** What happened, one name per kind of thing: `session.connect-failed`. */
  event: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
});

/** What the renderer may send: main adds the scope. */
export const RendererLogEntrySchema = LogEntrySchema.omit({ scope: true });

export type LogLevel = z.infer<typeof LogLevelSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
export type RendererLogEntry = z.infer<typeof RendererLogEntrySchema>;
