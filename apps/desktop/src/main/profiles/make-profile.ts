import { profileFromRoast } from '@roastpilot/core';
import {
  err,
  type MakeProfileError,
  type MakeProfileRequest,
  type ProfileEntry,
  type Result,
  type Roaster,
} from '@roastpilot/shared';
import type { HistoryService } from '../history/history-service';
import type { ProfileService } from './profile-service';

/** A new profile of your own from a saved roast, on the roaster it ran on. */
export async function makeProfileFromRoast(
  { roastId, style }: MakeProfileRequest,
  deps: {
    history: Pick<HistoryService, 'get'>;
    profiles: Pick<ProfileService, 'addOn'>;
    activeRoaster: () => Pick<Roaster, 'id' | 'batchIdealG'>;
    newId: () => string;
  },
): Promise<Result<ProfileEntry, MakeProfileError>> {
  const read = await deps.history.get(roastId);
  if (!read.ok) return read;
  const roaster = deps.activeRoaster();
  const profile = profileFromRoast({
    roast: read.value,
    style,
    id: deps.newId(),
    fallbackBatchG: roaster.batchIdealG,
  });
  if (!profile) return err({ kind: 'too-short' });
  const saved = await deps.profiles.addOn(profile, read.value.roasterId ?? roaster.id);
  if (saved.ok) return saved;
  return err({
    kind: 'storage-failed',
    message: saved.error.kind === 'storage-failed' ? saved.error.message : saved.error.kind,
  });
}
