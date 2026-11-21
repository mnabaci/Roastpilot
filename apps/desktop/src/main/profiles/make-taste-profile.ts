import {
  applyTasteChange,
  roastReport,
  serializeError,
  suggestTasteChange,
  tasteInput,
  type Logger,
} from '@roastpilot/core';
import {
  err,
  ok,
  type MakeTasteProfileError,
  type MakeTasteProfileRequest,
  type ProfileEntry,
  type ProfileError,
  type ProfileId,
  type Result,
  type Roaster,
} from '@roastpilot/shared';
import type { BeanService } from '../beans/bean-service';
import type { HistoryService } from '../history/history-service';
import { freeName } from './profile-copy';
import type { ProfileService } from './profile-service';

export interface MakeTasteProfileDeps {
  history: Pick<HistoryService, 'get'>;
  profiles: Pick<ProfileService, 'addOn' | 'delete' | 'ownNames'>;
  beans: Pick<BeanService, 'find' | 'linkProfile'>;
  activeRoaster: () => Pick<Roaster, 'id'>;
  newId: () => string;
  logger: Logger;
}

const storageFailed = (error: ProfileError | { kind: string }): MakeTasteProfileError => ({
  kind: 'storage-failed',
  message: 'message' in error && typeof error.message === 'string' ? error.message : error.kind,
});

/**
 * Make <bean> profile (docs/spec/beans-favourites-ghost.md, Make the profile): the roast's taste
 * suggestion, worked out again from what is saved, as a new profile with the one change, on the
 * roaster the roast ran on, made the bean's own. All or nothing: if linking fails, the new
 * profile is deleted again. The roast and its profile copy are never changed.
 */
export async function makeTasteProfile(
  { roastId }: MakeTasteProfileRequest,
  deps: MakeTasteProfileDeps,
): Promise<Result<ProfileEntry, MakeTasteProfileError>> {
  const read = await deps.history.get(roastId);
  if (!read.ok)
    return read.error.kind === 'not-found' ? err(read.error) : err(storageFailed(read.error));
  const roast = read.value;
  const input = tasteInput(roast, roastReport(roast));
  const suggestion = suggestTasteChange(input);
  if (suggestion?.kind !== 'change' || !input.profile) return err({ kind: 'no-change' });

  const bean = roast.beanId === null ? undefined : await deps.beans.find(roast.beanId);
  if (bean && !bean.ok) {
    return bean.error.kind === 'not-found'
      ? err({ kind: 'bean-not-found', id: bean.error.id })
      : err(storageFailed(bean.error));
  }
  const roasterId = roast.roasterId ?? deps.activeRoaster().id;
  const base = bean ? bean.value.name : `${input.profile.name} · tasted`;
  const profile = {
    ...applyTasteChange(input.profile, suggestion.change),
    id: deps.newId(),
    name: freeName(base, deps.profiles.ownNames(roasterId)),
    source: { kind: 'roast' as const, roastId },
  };
  const saved = await deps.profiles.addOn(profile, roasterId);
  if (!saved.ok) return err(storageFailed(saved.error));
  if (bean) {
    const linked = await linkOrUndo(bean.value, profile.id, deps);
    if (!linked.ok) return linked;
  }
  deps.logger.info('history.taste-profile-made', {
    roastId,
    profileId: profile.id,
    field: suggestion.change.field,
    from: suggestion.change.from,
    to: suggestion.change.to,
  });
  return saved;
}

/** Links the new profile to the bean; on any failure the profile goes again. */
async function linkOrUndo(
  bean: Parameters<BeanService['linkProfile']>[0],
  profileId: ProfileId,
  deps: Pick<MakeTasteProfileDeps, 'beans' | 'profiles' | 'logger'>,
): Promise<Result<void, MakeTasteProfileError>> {
  let linked;
  try {
    linked = await deps.beans.linkProfile(bean, profileId);
  } catch (error) {
    await removeProfile(profileId, deps);
    throw error;
  }
  if (linked.ok) return ok(undefined);
  await removeProfile(profileId, deps);
  return err(storageFailed(linked.error));
}

/** Takes the half-made profile away again; one that won't go is logged, never thrown. */
async function removeProfile(
  id: ProfileId,
  { profiles, logger }: Pick<MakeTasteProfileDeps, 'profiles' | 'logger'>,
): Promise<void> {
  try {
    const deleted = await profiles.delete(id);
    if (deleted.ok) logger.info('history.taste-profile-undone', { profileId: id });
    else logger.error('history.taste-profile-undo-failed', { profileId: id, error: deleted.error });
  } catch (error) {
    logger.error('history.taste-profile-undo-failed', {
      profileId: id,
      error: serializeError(error),
    });
  }
}
