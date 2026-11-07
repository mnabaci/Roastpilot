import { serializeError, type Logger } from '@roastpilot/core';
import {
  err,
  type MakeBeanProfileError,
  type MakeBeanProfileRequest,
  type ProfileEntry,
  type ProfileError,
  type ProfileId,
  type Result,
} from '@roastpilot/shared';
import type { ProfileService } from '../profiles/profile-service';
import type { BeanService } from './bean-service';

export interface MakeBeanProfileDeps {
  beans: Pick<BeanService, 'find' | 'linkProfile'>;
  profiles: Pick<ProfileService, 'duplicate' | 'delete'>;
  logger: Logger;
}

/**
 * A bean's own profile (docs/spec/beans-favourites-ghost.md): a copy of `profileId` named after
 * the bean, saved and linked to it. All or nothing: if linking fails, the copy is deleted again,
 * so a failure never leaves an unnamed profile behind.
 */
export async function makeBeanProfile(
  { beanId, profileId }: MakeBeanProfileRequest,
  { beans, profiles, logger }: MakeBeanProfileDeps,
): Promise<Result<ProfileEntry, MakeBeanProfileError>> {
  const bean = await beans.find(beanId);
  if (!bean.ok) {
    return bean.error.kind === 'not-found'
      ? err({ kind: 'bean-not-found', id: beanId })
      : err(bean.error);
  }
  const copy = await profiles.duplicate(profileId, bean.value.name);
  if (!copy.ok) return err(copyFailed(copy.error));
  const copyId = copy.value.profile.id;
  const undo = () => removeCopy(copyId, profiles, logger);

  let linked;
  try {
    linked = await beans.linkProfile(bean.value, copyId);
  } catch (error) {
    await undo();
    throw error;
  }
  if (!linked.ok) {
    await undo();
    const { error } = linked;
    return err({
      kind: 'storage-failed',
      message: error.kind === 'storage-failed' ? error.message : error.kind,
    });
  }
  logger.info('beans.profile-made', { beanId, profileId: copyId, from: profileId });
  return copy;
}

function copyFailed(error: ProfileError): MakeBeanProfileError {
  if (error.kind === 'not-found') return { kind: 'profile-not-found', id: error.id };
  return {
    kind: 'storage-failed',
    message: error.kind === 'storage-failed' ? error.message : error.kind,
  };
}

/** Takes the half-made copy away again; a copy that won't go is logged, never thrown. */
async function removeCopy(
  id: ProfileId,
  profiles: Pick<ProfileService, 'delete'>,
  logger: Logger,
): Promise<void> {
  try {
    const deleted = await profiles.delete(id);
    if (deleted.ok) logger.info('beans.make-profile-undone', { profileId: id });
    else logger.error('beans.make-profile-undo-failed', { profileId: id, error: deleted.error });
  } catch (error) {
    logger.error('beans.make-profile-undo-failed', { profileId: id, error: serializeError(error) });
  }
}
