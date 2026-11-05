import type { AutoProfile, ProfileId, Result, RoasterId, StorageError } from '@roastpilot/shared';

/** Your own profiles, each belonging to a roaster (docs/spec/data-model.md). Implemented in `storage`. */
export interface ProfileRepository {
  list(): Promise<Result<{ profile: AutoProfile; roasterId: RoasterId }[], StorageError>>;
  /** Adds it, or replaces the one with the same id. */
  save(profile: AutoProfile, roasterId: RoasterId): Promise<Result<void, StorageError>>;
  /** Whether it was there to remove. */
  delete(id: ProfileId): Promise<Result<boolean, StorageError>>;
}
