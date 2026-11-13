import {
  err,
  ok,
  type AutoProfile,
  type BeansApi,
  type HistoryApi,
  type LibraryFilesApi,
  type ProfilesApi,
  type Roaster,
  type RoastersApi,
} from '@roastpilot/shared';
import { accepted, cancelled, done, listening } from './answers';

/** No saved roasts; nothing to export or import. */
export const fakeHistoryApi = (): HistoryApi => ({
  exportRoasts: cancelled,
  importRoasts: cancelled,
  setRoastBean: accepted,
  importArtisan: cancelled,
  listRoasts: () => Promise.resolve([]),
  getRoast: (id) => Promise.resolve(err({ kind: 'not-found' as const, id })),
  deleteRoast: accepted,
  onRoastsChanged: listening,
});

/** No profiles; a save comes back as your own, the copies find nothing to copy. */
export const fakeProfilesApi = (): ProfilesApi => ({
  listProfiles: () => Promise.resolve([]),
  duplicateProfile: (id) => Promise.resolve(err({ kind: 'not-found' as const, id })),
  saveProfile: (profile: AutoProfile) => Promise.resolve(ok({ profile, builtIn: false })),
  deleteProfile: accepted,
  deleteProfiles: accepted,
  onProfiles: listening,
  copyProfile: (request) => Promise.resolve(err({ kind: 'not-found' as const, id: request.id })),
  makeProfileFromMilestones: () =>
    Promise.resolve(err({ kind: 'storage-failed' as const, message: 'not in this test' })),
});

/** No beans; a new one gets id 1, a bean profile finds no bean, a roast is too short. */
export const fakeBeansApi = (): BeansApi => ({
  listBeans: () => Promise.resolve([]),
  addBean: () => Promise.resolve(ok(1)),
  updateBean: accepted,
  setBeanArchived: accepted,
  openBeanLink: accepted,
  addStock: accepted,
  adjustStock: accepted,
  stockHistory: () => Promise.resolve(ok([])),
  onBeans: listening,
  makeBeanProfile: (request) =>
    Promise.resolve(err({ kind: 'bean-not-found' as const, id: request.beanId })),
  setRoastSetup: done,
  saveRoastResult: accepted,
  makeProfileFromRoast: () => Promise.resolve(err({ kind: 'too-short' as const })),
});

/** No roasters; a new one is refused, a saved one comes back as sent. */
export const fakeRoastersApi = (): RoastersApi => ({
  listRoasters: () => Promise.resolve([]),
  addRoaster: () => Promise.resolve(err({ kind: 'in-use' as const })),
  saveRoaster: (roaster: Roaster) => Promise.resolve(ok(roaster)),
  deleteRoaster: accepted,
  setActiveRoaster: accepted,
  chooseConnection: accepted,
  onRoasters: listening,
});

/** Beans, profiles and roasters files: both dialogs cancelled. */
export const fakeLibraryFilesApi = (): LibraryFilesApi => ({
  exportLibrary: cancelled,
  importLibrary: cancelled,
});
