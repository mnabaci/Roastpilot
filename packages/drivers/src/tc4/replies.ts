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

/**
 * Which lines answer which request. Loose on purpose: a garbled reply of the right shape still
 * reaches its parser and becomes a `bad-reply`; only another command's reply is turned away.
 * READ replies always hold commas, VERSION replies never do.
 */
export const isReadReplyShape = (line: string): boolean => line.includes(',');
export const isVersionReplyShape = (line: string): boolean => !line.includes(',');
