import { serializeError, type Logger, type ProfileRepository } from '@roastpilot/core';
import type { ProfileService } from './profiles/profile-service';
import type { RoasterService } from './roasters/roaster-service';
import { moveRetiredSoak, type RetiredSoakSetting } from './settings/move-soak';
import type { SettingsService } from './settings/settings-service';

/**
 * Reads what main serves from memory, before any window asks. A connection saved in Settings by an
 * older version moves into its roaster record, once (docs/spec/roasters.md, Moving over), and an
 * old Soak time setting into your own profiles (docs/spec/roast-control.md, From the old setting).
 */
export function startLoading({
  settings,
  retiredSoak,
  roasters,
  profiles,
  profileStore,
  logger,
}: {
  settings: SettingsService;
  retiredSoak: RetiredSoakSetting;
  roasters: RoasterService;
  profiles: ProfileService;
  profileStore: Pick<ProfileRepository, 'list'>;
  logger: Logger;
}): void {
  const load = async () => {
    const saved = await settings.get();
    await roasters.load();
    if (saved.connection) {
      const moved = await roasters.chooseConnection(saved.connection);
      if (moved.ok) await settings.set({ ...saved, connection: null });
      else logger.warn('settings.connection-not-moved', { error: moved.error });
    }
    await profiles.list();
    await moveRetiredSoak({ retired: retiredSoak, settings, profiles, profileStore, logger });
  };
  load().catch((error: unknown) => {
    logger.error('app.load-failed', { error: serializeError(error) });
  });
}
