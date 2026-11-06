import type { Result, Roaster, RoasterId, StorageError } from '@roastpilot/shared';

/** Roaster records (docs/spec/roasters.md). Implemented in `storage`. */
export interface RoasterRepository {
  list(): Promise<Result<Roaster[], StorageError>>;
  add(roaster: Omit<Roaster, 'id'>): Promise<Result<Roaster, StorageError>>;
  save(roaster: Roaster): Promise<Result<void, StorageError>>;
  /** Makes this one active, and no other. */
  setActive(id: RoasterId): Promise<Result<void, StorageError>>;
  /** How much belongs to it: what stops it being deleted. */
  usage(id: RoasterId): Promise<Result<{ roasts: number; profiles: number }, StorageError>>;
  delete(id: RoasterId): Promise<Result<void, StorageError>>;
}
