import { serializeError, type Logger } from '@roastpilot/core';
import type { RoastpilotApi, Unsubscribe } from '@roastpilot/shared';
import { addReading, setRoast } from '../stores/roast-store';
import { applySafetyEvent } from '../stores/safety-store';
import type { Stores } from '../stores/stores';

type SyncApi = Pick<
  RoastpilotApi,
  | 'getSnapshot'
  | 'getSettings'
  | 'listProfiles'
  | 'onProfiles'
  | 'listRoasters'
  | 'listBeans'
  | 'onBeans'
  | 'onRoastsChanged'
  | 'onRoasters'
  | 'onReading'
  | 'onConnection'
  | 'onSafetyEvent'
  | 'onRoast'
  | 'onAutoStatus'
  | 'onCoachStatus'
  | 'getAppInfo'
  | 'onUpdateStatus'
>;

/**
 * Keeps the stores a mirror of main: listens first, then loads the snapshot, so nothing that
 * happens in between is lost (the snapshot already includes it).
 */
export function syncWithMain(api: SyncApi, stores: Stores, logger: Logger): Unsubscribe {
  // A pushed profile list is newer than the one the first load asked for.
  let profilesHeard = false;
  // An update status that arrives before the app info is newer than the info's.
  let updateHeard = false;
  const stops = [
    api.onReading((reading) => {
      stores.roast.setState((data) => addReading(data, reading));
    }),
    api.onConnection((connection) => {
      stores.connection.setState({ connection });
    }),
    api.onSafetyEvent((event) => {
      stores.safety.setState((state) => applySafetyEvent(state, event), true);
    }),
    api.onRoast((roast) => {
      stores.roast.setState((data) => setRoast(data, roast));
      if (roast.chargedAtMs === null) stores.beans.setState({ currentRoastId: null });
    }),
    api.onAutoStatus((status) => {
      stores.auto.setState({ status });
    }),
    api.onCoachStatus((status) => {
      stores.coach.setState({ status });
    }),
    api.onUpdateStatus((status) => {
      updateHeard = true;
      stores.updates.setState({ status });
    }),
    api.onBeans((beans) => {
      stores.beans.setState({ beans });
    }),
    api.onRoastsChanged(({ id, deleted, current }) => {
      const { setup, currentRoastId } = stores.beans.getState();
      if (current) stores.beans.setState({ currentRoastId: id });
      if (deleted && currentRoastId === id) stores.beans.setState({ currentRoastId: null });
      if (deleted && setup.ghostRoastId === id) {
        stores.beans.setState({ setup: { ...setup, ghostRoastId: null } });
      }
    }),
    api.onRoasters((roasters) => {
      stores.roasters.setState({ roasters });
    }),
    api.onProfiles((profiles) => {
      profilesHeard = true;
      stores.auto.setState({ profiles });
    }),
  ];
  api
    .getAppInfo()
    .then(({ version, update }) => {
      stores.updates.setState(updateHeard ? { version } : { version, status: update });
    })
    .catch((error: unknown) => {
      logger.error('sync.app-info-failed', { error: serializeError(error) });
    });
  Promise.all([
    api.getSnapshot(),
    api.getSettings(),
    api.listProfiles(),
    api.listRoasters(),
    api.listBeans(),
  ])
    .then(([snapshot, settings, profiles, roasters, beans]) => {
      stores.connection.setState({ connection: snapshot.connection });
      stores.roast.setState({ roast: snapshot.roast, readings: [...snapshot.readings] });
      stores.safety.setState(snapshot.safety, true);
      stores.settings.setState({ settings });
      // A list pushed meanwhile (a write, a roaster switch) is newer than this one.
      stores.auto.setState(
        profilesHeard ? { status: snapshot.auto } : { status: snapshot.auto, profiles },
      );
      stores.coach.setState({ status: snapshot.coach });
      stores.roasters.setState({ roasters });
      stores.beans.setState({
        beans,
        setup: snapshot.setup,
        currentRoastId: snapshot.currentRoastId,
      });
      stores.sync.setState({ ready: true });
    })
    .catch((error: unknown) => {
      logger.error('sync.snapshot-failed', { error: serializeError(error) });
      // Show the screens anyway; events keep them current from here.
      stores.sync.setState({ ready: true });
    });
  return () => {
    for (const stop of stops) stop();
  };
}
