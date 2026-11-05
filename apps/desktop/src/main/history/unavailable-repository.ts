import type { ProfileRepository, RoasterRepository, RoastRepository } from '@roastpilot/core';
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

/** The same for your own profiles: the built-ins stay available, saving says why it can't. */
export function unavailableProfiles(message: string): ProfileRepository {
  const fail = () => Promise.resolve(err({ kind: 'storage-failed' as const, message }));
  return { list: fail, save: fail, delete: fail };
}

/** The same for roaster records: the built-ins stand in, changes say why they can't be saved. */
export function unavailableRoasters(message: string): RoasterRepository {
  const fail = () => Promise.resolve(err({ kind: 'storage-failed' as const, message }));
  return { list: fail, add: fail, save: fail, setActive: fail, usage: fail, delete: fail };
}
