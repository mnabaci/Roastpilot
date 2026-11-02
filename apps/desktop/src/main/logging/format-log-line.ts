import { serializeError } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';

/** One JSON line: time first, then level, scope, event and context. Never throws. */
export function formatLogLine(entry: LogEntry, time: Date): string {
  const record = { time: time.toISOString(), ...entry };
  try {
    return `${JSON.stringify(record, (_key, value: unknown) => (typeof value === 'bigint' ? String(value) : serializeError(value)))}\n`;
  } catch {
    // Circular or otherwise unserializable context: keep the line, drop the context, say so.
    return `${JSON.stringify({ ...record, context: '[unserializable]' })}\n`;
  }
}
