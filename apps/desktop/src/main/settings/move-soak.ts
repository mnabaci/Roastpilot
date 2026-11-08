import type { Logger, ProfileRepository } from '@roastpilot/core';
import { setOwnSoaks } from '../profiles/own-soaks';
import type { ProfileService } from '../profiles/profile-service';
import type { SettingsService } from './settings-service';

/**
 * The Soak time setting from before the soak moved into profiles: read from the settings file,
 * kept there until it has been moved (docs/spec/roast-control.md, From the old setting).
 */
export interface RetiredSoakSetting {
  /** Seconds; undefined once moved, or when the file never had one. */
  retiredSoakS(): number | undefined;
  /** The next save leaves it out. */
  forgetRetiredSoak(): void;
}

/** The built-ins' soak, which every profile ran before you changed the setting. */
const BUILT_IN_SOAK_S = 60;

/**
 * Moves the old Soak time setting into your own profiles that soak, once: anything but 1:00 is
 * written into them, then the setting goes. If that fails it stays, to try again next launch.
 */
export async function moveRetiredSoak({
  retired,
  settings,
  profiles,
  profileStore,
  logger,
}: {
  retired: RetiredSoakSetting;
  settings: Pick<SettingsService, 'latest' | 'set'>;
  profiles: Pick<ProfileService, 'addOn'>;
  /** Read for your own profiles on every roaster. */
  profileStore: Pick<ProfileRepository, 'list'>;
  logger: Logger;
}): Promise<void> {
  const soakS = retired.retiredSoakS();
  if (soakS === undefined) return;
  let count = 0;
  if (soakS !== BUILT_IN_SOAK_S) {
    const moved = await setOwnSoaks(soakS, { store: profileStore, profiles });
    if (!moved.ok) {
      logger.warn('settings.soak-not-moved', { soakS, error: moved.error });
      return;
    }
    count = moved.value;
  }
  retired.forgetRetiredSoak();
  const saved = await settings.set(settings.latest);
  // The profiles have it now; moving it again next launch writes the same length.
  if (!saved.ok) logger.warn('settings.soak-not-removed', { error: saved.error });
  logger.info('settings.soak-moved', { soakS, count });
}
