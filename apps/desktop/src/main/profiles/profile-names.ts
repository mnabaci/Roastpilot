import type { ProfileRepository } from '@roastpilot/core';
import { ROASTER_MODELS } from '@roastpilot/drivers';
import { ok, type ProfileId, type Result, type StorageError } from '@roastpilot/shared';

/**
 * Every profile's name by id: each model's built-ins, and your own on any roaster. Read straight
 * from storage, so it never changes what the profile service holds.
 */
export async function allProfileNames(
  store: Pick<ProfileRepository, 'list'>,
): Promise<Result<Map<ProfileId, string>, StorageError>> {
  const read = await store.list();
  if (!read.ok) return read;
  const builtIns = Object.values(ROASTER_MODELS).flatMap((model) => model.profiles);
  const all = [...builtIns, ...read.value.map((own) => own.profile)];
  return ok(new Map(all.map((profile) => [profile.id, profile.name])));
}
