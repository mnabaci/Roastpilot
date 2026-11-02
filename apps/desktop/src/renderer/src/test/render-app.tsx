import { silentLogger } from '@roastpilot/core';
import { ok, type RoastpilotApi } from '@roastpilot/shared';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi, type Mocked } from 'vitest';
import { INITIAL_STATE, type AppState } from '../state/app-state';
import { createAppStore } from '../state/app-store';
import { AppProvider } from '../state/AppProvider';

/** A `window.roastpilot` whose calls all succeed; override what a test needs. */
export function fakeApi(overrides: Partial<RoastpilotApi> = {}): Mocked<RoastpilotApi> {
  const unsubscribe = () => undefined;
  return {
    listPorts: vi.fn(() => Promise.resolve([])),
    connect: vi.fn(() => Promise.resolve(ok(undefined))),
    disconnect: vi.fn(() => Promise.resolve()),
    setOutput: vi.fn(() => Promise.resolve(ok(undefined))),
    emergencyStop: vi.fn(() => Promise.resolve()),
    acknowledgeSafety: vi.fn(() => Promise.resolve(ok(undefined))),
    onReading: vi.fn(() => unsubscribe),
    onConnection: vi.fn(() => unsubscribe),
    onSafetyEvent: vi.fn(() => unsubscribe),
    log: vi.fn(),
    getSnapshot: vi.fn(() =>
      Promise.resolve({
        connection: INITIAL_STATE.connection,
        roast: INITIAL_STATE.roast,
        readings: [],
        safety: INITIAL_STATE.safety,
      }),
    ),
    roastAction: vi.fn(() => Promise.resolve(ok(undefined))),
    onRoast: vi.fn(() => unsubscribe),
    getSettings: vi.fn(() => Promise.resolve(INITIAL_STATE.settings)),
    setSettings: vi.fn((settings) => Promise.resolve(ok(settings))),
    ...overrides,
  } as Mocked<RoastpilotApi>;
}

const percent = { kind: 'output', unit: 'percent', min: 0, max: 100, step: 5 } as const;
export const CONNECTED: AppState['connection'] = {
  status: 'connected',
  channels: [
    { id: 'bt', kind: 'sensor', unit: 'celsius' },
    { id: 'heater', ...percent },
    { id: 'fan', ...percent },
    { id: 'cooling', ...percent },
    { id: 'drum', kind: 'output', unit: 'on-off', min: 0, max: 1, step: 1 },
  ],
};

/** Renders `ui` with a store already in `state` (ready), and returns the fakes. */
export function renderApp(ui: ReactNode, state: Partial<AppState> = {}, api = fakeApi()) {
  const store = createAppStore({ ...INITIAL_STATE, ready: true, ...state });
  const view = render(<AppProvider deps={{ api, store, logger: silentLogger }}>{ui}</AppProvider>);
  return { ...view, api, store };
}
