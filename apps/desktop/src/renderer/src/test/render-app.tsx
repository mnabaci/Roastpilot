import { silentLogger, type Logger } from '@roastpilot/core';
import {
  DEFAULT_SETTINGS,
  SAFETY_NOTICE_VERSION,
  type ConnectionState,
  type RoastpilotApi,
} from '@roastpilot/shared';
import { PlotEngineProvider } from '@roastpilot/ui';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi, type Mocked } from 'vitest';
import { AppProvider } from '../app/AppProvider';
import type { ChimePlayer } from '../features/chime';
import { fakePlotEngine } from './fake-plot-engine';
import { createStores, type StoresSeed } from '../stores/stores';
import { fakeAppApi } from './fake-api';
import { withSpies } from './with-spies';

/** A `window.roastpilot` whose calls all succeed, each a spy; override what a test needs. */
export function fakeApi(overrides: Partial<RoastpilotApi> = {}): Mocked<RoastpilotApi> {
  return withSpies(fakeAppApi(overrides));
}

const percent = { kind: 'output', unit: 'percent', min: 0, max: 100, step: 5 } as const;
export const CONNECTED: ConnectionState = {
  status: 'connected',
  target: { kind: 'serial', path: '/dev/cu.usbserial-0001' },
  channels: [
    { id: 'bt', kind: 'sensor', unit: 'celsius', name: 'Temperature', short: 'Temp' },
    { id: 'heater', ...percent },
    { id: 'fan', ...percent },
    { id: 'cooling', ...percent },
    { id: 'filter', ...percent },
    { id: 'drum', kind: 'output', unit: 'on-off', min: 0, max: 1, step: 1 },
  ],
};

/** A chime player that only remembers what it was asked to play. */
export const fakeChime = (): Mocked<ChimePlayer> => ({ play: vi.fn() });

/** Settings once the safety notice is accepted, as on every launch after the first. */
export const ACCEPTED_SETTINGS = {
  ...DEFAULT_SETTINGS,
  safetyNoticeAccepted: SAFETY_NOTICE_VERSION,
};

/**
 * Renders `ui` with stores already seeded (and ready), and returns the fakes. Charts draw through
 * a fake plot engine (jsdom has no canvas), so no test needs to mock a module.
 */
export function renderApp(
  ui: ReactNode,
  seed: StoresSeed = {},
  api = fakeApi(),
  logger: Logger = silentLogger,
) {
  const stores = createStores({ ready: true, settings: ACCEPTED_SETTINGS, ...seed });
  const chime = fakeChime();
  const view = render(
    <PlotEngineProvider value={fakePlotEngine}>
      <AppProvider deps={{ api, stores, logger, chime }}>{ui}</AppProvider>
    </PlotEngineProvider>,
  );
  return { ...view, api, stores, chime };
}
