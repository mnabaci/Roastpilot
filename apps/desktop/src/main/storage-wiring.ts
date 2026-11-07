import type {
  BeanRepository,
  Clock,
  Logger,
  ProfileRepository,
  RoasterRepository,
  RoastRepository,
} from '@roastpilot/core';
import {
  drizzleOn,
  openDatabase,
  SqliteBeanRepository,
  SqliteProfileRepository,
  SqliteRoasterRepository,
  SqliteRoastRepository,
} from '@roastpilot/storage';
import {
  unavailableBeans,
  unavailableProfiles,
  unavailableRepository,
  unavailableRoasters,
} from './history/unavailable-repository';

export interface Stores {
  roasts: RoastRepository;
  profileStore: ProfileRepository;
  roasterStore: RoasterRepository;
  beanStore: BeanRepository;
  /** Closes the database, if it opened. */
  close: () => void;
}

/**
 * The saved data (docs/spec/data-model.md). Without a database the app still roasts: every store
 * stands in with one that fails with the reason, so History and the other screens can say why.
 */
export function openStores(path: string, clock: Clock, logger: Logger): Stores {
  const database = openDatabase(path, logger);
  if (!database.ok) {
    const reason =
      database.error.kind === 'storage-failed' ? database.error.message : 'unavailable';
    return {
      roasts: unavailableRepository(reason),
      profileStore: unavailableProfiles(reason),
      roasterStore: unavailableRoasters(reason),
      beanStore: unavailableBeans(reason),
      close: () => undefined,
    };
  }
  const db = drizzleOn(database.value);
  return {
    roasts: new SqliteRoastRepository(db, logger),
    profileStore: new SqliteProfileRepository(db, clock, logger),
    roasterStore: new SqliteRoasterRepository(db, logger),
    beanStore: new SqliteBeanRepository(db),
    close: () => {
      database.value.close();
    },
  };
}
