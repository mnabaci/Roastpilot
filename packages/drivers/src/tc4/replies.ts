import type { DriverError } from '@roastpilot/core';
import { err, ok, type Result } from '@roastpilot/shared';

export interface ReadReply {
  bt: number;
  heater: number;
  fan: number;
}

/** Parses `0.00,<temp>,<temp>,<heater>,<fan>,0` (docs/spec/hardware.md, READ reply). */
export function parseReadReply(line: string): Result<ReadReply, DriverError> {
  const fields = line.trim().split(',');
  const numbers = fields.map(Number);
  const [, bt, , heater, fan] = numbers;
  if (
    fields.length !== 6 ||
    fields.some((f) => f.trim() === '') ||
    !numbers.every(Number.isFinite)
  ) {
    return err({ kind: 'bad-reply', line });
  }
  if (bt === undefined || heater === undefined || fan === undefined)
    return err({ kind: 'bad-reply', line });
  return ok({ bt, heater, fan });
}

/** Parses the reply to VERSION: a whole number. */
export function parseVersionReply(line: string): Result<number, DriverError> {
  const text = line.trim();
  return /^\d+$/.test(text) ? ok(Number(text)) : err({ kind: 'bad-reply', line });
}
