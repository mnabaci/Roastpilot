import { silentLogger, type RoasterRepository } from '@roastpilot/core';
import { BUILT_IN_ROASTERS } from '@roastpilot/drivers';
import { ok, type Roaster } from '@roastpilot/shared';
import { vi } from 'vitest';
import { RoasterService } from './roaster-service';

/** A service over an in-memory repository holding the built-ins; `connect` marks it in use. */
export function setup(usage = { roasts: 0, profiles: 0 }) {
  let stored: Roaster[] = [...BUILT_IN_ROASTERS];
  let inUse = false;
  const repository: RoasterRepository = {
    list: () => Promise.resolve(ok(stored)),
    add: (roaster) => {
      const added = { ...roaster, id: stored.length + 1 };
      stored = [...stored, added];
      return Promise.resolve(ok(added));
    },
    addAll: (list) => {
      const added = list.map((roaster, i) => ({ ...roaster, id: stored.length + 1 + i }));
      stored = [...stored, ...added];
      return Promise.resolve(ok(added));
    },
    save: (roaster) => {
      stored = stored.map((r) => (r.id === roaster.id ? roaster : r));
      return Promise.resolve(ok(undefined));
    },
    setActive: (id) => {
      stored = stored.map((r) => ({ ...r, active: r.id === id }));
      return Promise.resolve(ok(undefined));
    },
    usage: () => Promise.resolve(ok(usage)),
    delete: (id) => {
      stored = stored.filter((r) => r.id !== id);
      return Promise.resolve(ok(undefined));
    },
  };
  const onChange = vi.fn();
  const service = new RoasterService({
    repository,
    inUse: () => inUse,
    onChange,
    logger: silentLogger,
  });
  return {
    service,
    onChange,
    repository,
    stored: () => stored,
    connect: () => {
      inUse = true;
    },
  };
}
