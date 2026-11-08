import type { Logger, ProfileRepository } from '@roastpilot/core';
import type { LibraryKind } from '@roastpilot/shared';
import type { BeanService } from '../beans/bean-service';
import { allProfileNames } from '../profiles/profile-names';
import type { ProfileService } from '../profiles/profile-service';
import type { RoasterService } from '../roasters/roaster-service';
import { beanCodec } from './bean-codec';
import { libraryFiles, type LibraryFiles } from './library-kind';
import { profileCodec } from './profile-codec';
import { roasterCodec } from './roaster-codec';

/** Each kind's Roastpilot files, registered at startup (docs/spec/extensibility.md). */
export function createLibraryKinds({
  beans,
  profiles,
  profileStore,
  roasters,
  newProfileId,
  now,
  logger,
}: {
  beans: Pick<BeanService, 'read' | 'addAll'>;
  profiles: Pick<ProfileService, 'list' | 'addAll'>;
  /** Read for every profile's name, on any roaster. */
  profileStore: Pick<ProfileRepository, 'list'>;
  roasters: Pick<RoasterService, 'all' | 'addAll' | 'active'>;
  newProfileId: () => string;
  now: () => Date;
  logger: Logger;
}): Record<LibraryKind, LibraryFiles> {
  const options = { now, logger };
  return {
    beans: libraryFiles(
      'beans',
      beanCodec({ beans, profiles, profileNames: () => allProfileNames(profileStore) }),
      options,
    ),
    profiles: libraryFiles(
      'profiles',
      profileCodec({ profiles, activeRoaster: () => roasters.active(), newId: newProfileId }),
      options,
    ),
    roasters: libraryFiles('roasters', roasterCodec({ roasters }), options),
  };
}
