import type { AutoProfile, ProfileId, Result, StorageError } from '@roastpilot/shared';

/** Your own profiles (docs/spec/data-model.md, Auto mode). Implemented in `storage`. */
export interface ProfileRepository {
  list(): Promise<Result<AutoProfile[], StorageError>>;
  /** Adds it, or replaces the one with the same id. */
  save(profile: AutoProfile): Promise<Result<void, StorageError>>;
  /** Whether it was there to remove. */
  delete(id: ProfileId): Promise<Result<boolean, StorageError>>;
}
