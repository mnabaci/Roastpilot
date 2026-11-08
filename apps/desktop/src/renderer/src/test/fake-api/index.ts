import type { RoastpilotApi } from '@roastpilot/shared';
import { fakeSettingsApi, fakeUpdatesApi, fakeWindowApi } from './app';
import { fakeBeansApi, fakeHistoryApi, fakeProfilesApi, fakeRoastersApi } from './library';
import { fakeRoastApi, fakeRoasterApi } from './session';

// The one fake `window.roastpilot`, for the renderer tests (wrapped in spies by `render-app`) and
// the screen stories (answering from the sample world). Typed by area from the preload API, so a
// new IPC call does not compile until it has a fake answer here. No Vitest: the stories run it.

/** A `window.roastpilot` whose calls all succeed on empty data; override what you need. */
export function fakeAppApi(overrides: Partial<RoastpilotApi> = {}): RoastpilotApi {
  const api: RoastpilotApi = {
    ...fakeRoasterApi(),
    ...fakeRoastApi(),
    ...fakeHistoryApi(),
    ...fakeProfilesApi(),
    ...fakeBeansApi(),
    ...fakeRoastersApi(),
    ...fakeWindowApi(),
    ...fakeSettingsApi(),
    ...fakeUpdatesApi(),
  };
  return { ...api, ...overrides };
}
