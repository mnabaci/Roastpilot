import type { Logger } from '@roastpilot/core';
import { type Reading, DEFAULT_SETTINGS } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { fakeApi } from '../test/render-app';
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
});
