import type { AutoProfile, ProfileId, Result, RoasterId, StorageError } from '@roastpilot/shared';

/** Your own profiles, each belonging to a roaster (docs/spec/data-model.md). Implemented in `storage`. */
export interface ProfileRepository {
  list(): Promise<Result<{ profile: AutoProfile; roasterId: RoasterId }[], StorageError>>;
  /** Adds it, or replaces the one with the same id. */
  save(profile: AutoProfile, roasterId: RoasterId): Promise<Result<void, StorageError>>;
  /** Saves them all on one roaster, all or nothing (an import). */
  saveAll(
    profiles: readonly AutoProfile[],
    roasterId: RoasterId,
  ): Promise<Result<void, StorageError>>;
  /**
   * Removes them all at once, all or nothing, unlinking every bean that pointed at one; how many
   * were there to remove.
   */
  deleteMany(ids: readonly ProfileId[]): Promise<Result<number, StorageError>>;
}
