import type { RoastRepository } from '@roastpilot/core';
import { err } from '@roastpilot/shared';

/**
 * Stands in when the database can't be opened: roasting still works, every save and read fails
 * with the reason (logged once per streak by the recorder, and per request by HistoryService).
 */
export function unavailableRepository(message: string): RoastRepository {
  const fail = () => Promise.resolve(err({ kind: 'storage-failed' as const, message }));
  return {
    create: fail,
    addSamples: fail,
    addEvent: fail,
    update: fail,
    list: fail,
    get: fail,
    delete: fail,
  };
}
