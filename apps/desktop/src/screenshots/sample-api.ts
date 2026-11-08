import { err, ok, UPDATES_OFF, type RoastpilotApi, type Screen } from '@roastpilot/shared';
import { fakeAppApi } from '../renderer/src/test/fake-api';
import type { AppState } from './app-state';

const frozen = () => Promise.resolve(err({ kind: 'storage-failed' as const, message: 'a sample' }));

/**
 * `window.roastpilot` for a scene: answers every question from the frozen state, opens `screen`
 * as the app menu would, and changes nothing (a picture has no roaster to talk to). Listeners
 * are asked for and never sent (a scene is one moment); actions do nothing and say they worked.
 */
export function sampleApi(state: AppState, screen: Screen): RoastpilotApi {
  return fakeAppApi({
    getSnapshot: () => Promise.resolve(state.snapshot),
    getSettings: () => Promise.resolve(state.settings),
    listProfiles: () => Promise.resolve(state.profiles),
    listRoasters: () => Promise.resolve(state.roasters),
    listBeans: () => Promise.resolve(state.beans),
    listRoasts: () => Promise.resolve(state.roasts),
    getRoast: (id) => {
      const detail = state.details.find((d) => d.id === id);
      return Promise.resolve(detail ? ok(detail) : err({ kind: 'not-found' as const, id }));
    },
    getAppInfo: () => Promise.resolve({ version: '0.0.0', update: UPDATES_OFF }),
    onNavigate: (listener) => {
      listener(screen);
      return () => undefined;
    },
    // Anything that would make something new is refused: the sample world stays as it is.
    duplicateProfile: frozen,
    saveProfile: frozen,
    copyProfile: frozen,
    makeProfileFromMilestones: frozen,
    addRoaster: frozen,
    addBean: frozen,
    makeBeanProfile: frozen,
    makeProfileFromRoast: frozen,
  });
}
