import { soakLengthS, type ProfileRepository } from '@roastpilot/core';
import { err, ok, type ProfileError, type Result } from '@roastpilot/shared';
import type { ProfileService } from './profile-service';

/**
 * Your own profiles that soak, on every roaster, set to soak `soakS`; how many changed. Built-ins
 * and profiles without a soak stay as they are (docs/spec/roast-control.md, From the old setting).
 */
export async function setOwnSoaks(
  soakS: number,
  {
    store,
    profiles,
  }: { store: Pick<ProfileRepository, 'list'>; profiles: Pick<ProfileService, 'addOn'> },
): Promise<Result<number, ProfileError>> {
  const read = await store.list();
  if (!read.ok) {
    const { error } = read;
    return err({
      kind: 'storage-failed',
      message: 'message' in error ? error.message : error.kind,
    });
  }
  const changing = read.value.filter(({ profile }) => {
    const lengthS = soakLengthS(profile);
    return lengthS > 0 && lengthS !== soakS;
  });
  for (const { profile, roasterId } of changing) {
    const [soak, ...steps] = profile.phases;
    if (!soak) continue;
    const phases = [{ ...soak, next: { on: 'time' as const, afterS: soakS } }, ...steps];
    const saved = await profiles.addOn({ ...profile, phases }, roasterId);
    if (!saved.ok) return saved;
  }
  return ok(changing.length);
}
