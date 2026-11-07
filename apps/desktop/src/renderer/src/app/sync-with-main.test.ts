import type { Logger } from '@roastpilot/core';
import {
  type AppInfo,
  type Reading,
  type UpdateStatus,
  DEFAULT_SETTINGS,
  READY_ROAST,
} from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { fakeApi } from '../test/render-app';
import { BUILT_INS } from '../test/profiles';
import { createStores } from '../stores/stores';
import { syncWithMain } from './sync-with-main';

const logger = () =>
  ({ error: vi.fn() }) as unknown as Logger & { error: ReturnType<typeof vi.fn> };

describe('syncWithMain', () => {
  it('loads the snapshot and settings, then follows events', async () => {
    let onReading: (r: Reading) => void = () => undefined;
    const api = fakeApi({
      onReading: (listener) => {
        onReading = listener;
        return () => undefined;
      },
      getSettings: () =>
        Promise.resolve({
          ...DEFAULT_SETTINGS,
          connection: { kind: 'simulator' },
          controls: 'full',
          chartSmoothingS: 5,
        }),
    });
    const stores = createStores();
    syncWithMain(api, stores, logger());
    await vi.waitFor(() => {
      expect(stores.sync.getState().ready).toBe(true);
    });
    expect(stores.settings.getState().settings.controls).toBe('full');
    onReading({ atMs: 1, values: { bt: 150 } });
    expect(stores.roast.getState().readings).toEqual([{ atMs: 1, values: { bt: 150 } }]);
  });

  it('listens before it loads, so nothing in between is lost', () => {
    const order: string[] = [];
    const api = fakeApi({
      onReading: () => {
        order.push('listen');
        return () => undefined;
      },
      getSnapshot: () => {
        order.push('snapshot');
        return new Promise(() => undefined);
      },
    });
    syncWithMain(api, createStores(), logger());
    expect(order).toEqual(['listen', 'snapshot']);
  });

  it('a failed snapshot is logged and the screens still show', async () => {
    const api = fakeApi({ getSnapshot: () => Promise.reject(new Error('main gone')) });
    const stores = createStores();
    const log = logger();
    syncWithMain(api, stores, log);
    await vi.waitFor(() => {
      expect(stores.sync.getState().ready).toBe(true);
    });
    expect(log.error).toHaveBeenCalledWith('sync.snapshot-failed', expect.objectContaining({}));
    expect(stores.connection.getState().connection).toEqual({ status: 'disconnected' });
  });

  it('stops every listener', () => {
    const stops = Array.from({ length: 4 }, () => vi.fn());
    const api = fakeApi({
      onReading: () => stops[0]!,
      onConnection: () => stops[1]!,
      onSafetyEvent: () => stops[2]!,
      onRoast: () => stops[3]!,
    });
    syncWithMain(api, createStores(), logger())();
    for (const stop of stops) expect(stop).toHaveBeenCalledOnce();
  });

  it('forgets a ghost that was deleted, and keeps it when another roast changes', () => {
    let changed: (change: { id: number; deleted: boolean }) => void = () => undefined;
    const api = fakeApi({
      onRoastsChanged: vi.fn((listener: typeof changed) => {
        changed = listener;
        return () => undefined;
      }),
    });
    const setup = { beanId: 1, batchG: 300, ghostRoastId: 5 };
    const stores = createStores({ setup });
    syncWithMain(api, stores, logger());
    changed({ id: 5, deleted: false });
    changed({ id: 6, deleted: true });
    expect(stores.beans.getState().setup).toEqual(setup);
    changed({ id: 5, deleted: true });
    expect(stores.beans.getState().setup).toEqual({ ...setup, ghostRoastId: null });
  });

  it('follows the roast on screen: not older roasts, and not once deleted or cleared', () => {
    let changed: (change: { id: number; deleted: boolean; current?: boolean }) => void = () =>
      undefined;
    let roast: (state: typeof READY_ROAST) => void = () => undefined;
    const api = fakeApi({
      onRoastsChanged: vi.fn((listener: typeof changed) => {
        changed = listener;
        return () => undefined;
      }),
      onRoast: vi.fn((listener: typeof roast) => {
        roast = listener;
        return () => undefined;
      }),
    });
    const stores = createStores();
    syncWithMain(api, stores, logger());
    const current = () => stores.beans.getState().currentRoastId;
    changed({ id: 8, deleted: false, current: true });
    expect(current()).toBe(8);
    changed({ id: 3, deleted: false });
    expect(current()).toBe(8);
    changed({ id: 8, deleted: true });
    expect(current()).toBeNull();
    changed({ id: 9, deleted: false, current: true });
    roast(READY_ROAST);
    expect(current()).toBeNull();
  });

  it('keeps the newest profile list when an older answer arrives late', async () => {
    let roastersChanged: (roasters: never[]) => void = () => undefined;
    const answers: ((profiles: typeof BUILT_INS) => void)[] = [];
    const api = fakeApi({
      onRoasters: vi.fn((listener: typeof roastersChanged) => {
        roastersChanged = listener;
        return () => undefined;
      }),
      listProfiles: vi.fn(
        () =>
          new Promise<typeof BUILT_INS>((resolve) => {
            answers.push(resolve);
          }),
      ),
    });
    const stores = createStores();
    syncWithMain(api, stores, logger());
    roastersChanged([]);
    // The newer list (after the roaster switch) lands first, then the snapshot's older one.
    answers[1]?.(BUILT_INS.slice(1));
    answers[0]?.(BUILT_INS);
    await vi.waitFor(() => {
      expect(stores.sync.getState().ready).toBe(true);
    });
    expect(stores.auto.getState().profiles).toEqual(BUILT_INS.slice(1));
  });

  describe('updates', () => {
    it('loads the version and the update status', async () => {
      const api = fakeApi({
        getAppInfo: () =>
          Promise.resolve({
            version: '0.1.0',
            update: { state: 'available', version: '0.2.0', reason: 'cant-replace' },
          }),
      });
      const stores = createStores();
      syncWithMain(api, stores, logger());
      await vi.waitFor(() => {
        expect(stores.updates.getState()).toEqual({
          version: '0.1.0',
          status: { state: 'available', version: '0.2.0', reason: 'cant-replace' },
        });
      });
    });

    it('follows status events, and an event before the info wins over the older info', async () => {
      let send: (status: UpdateStatus) => void = () => undefined;
      let answer: (info: AppInfo) => void = () => undefined;
      const api = fakeApi({
        onUpdateStatus: (listener) => {
          send = listener;
          return () => undefined;
        },
        getAppInfo: () =>
          new Promise<AppInfo>((resolve) => {
            answer = resolve;
          }),
      });
      const stores = createStores();
      syncWithMain(api, stores, logger());
      send({ state: 'ready', version: '0.2.0' });
      answer({ version: '0.1.0', update: { state: 'downloading', version: '0.2.0', percent: 90 } });
      await vi.waitFor(() => {
        expect(stores.updates.getState().version).toBe('0.1.0');
      });
      expect(stores.updates.getState().status).toEqual({ state: 'ready', version: '0.2.0' });
    });

    it('app info that fails is logged; the other screens still load', async () => {
      const api = fakeApi({ getAppInfo: () => Promise.reject(new Error('main gone')) });
      const stores = createStores();
      const log = logger();
      syncWithMain(api, stores, log);
      await vi.waitFor(() => {
        expect(log.error).toHaveBeenCalledWith('sync.app-info-failed', expect.anything());
      });
      expect(stores.updates.getState()).toEqual({ version: null, status: null });
      await vi.waitFor(() => {
        expect(stores.sync.getState().ready).toBe(true);
      });
    });
  });
});
