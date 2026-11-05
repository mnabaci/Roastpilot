import { serializeError, type Logger } from '@roastpilot/core';
import type { ProfileService } from './profiles/profile-service';
import type { RoasterService } from './roasters/roaster-service';
import type { SettingsService } from './settings/settings-service';

/**
 * Reads what main serves from memory, before any window asks. A connection saved in Settings by an
 * older version moves into its roaster record, once (docs/spec/roasters.md, Moving over).
 */
export function startLoading({
  settings,
  roasters,
  profiles,
  logger,
}: {
  settings: SettingsService;
  roasters: RoasterService;
  profiles: ProfileService;
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
  };
  load().catch((error: unknown) => {
    logger.error('app.load-failed', { error: serializeError(error) });
  });
}
