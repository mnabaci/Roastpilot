import { silentLogger } from '@roastpilot/core';
import {
  AUTO_OFF,
  DEFAULT_SETTINGS,
  NO_ROAST_SETUP,
  err,
  ok,
  type AutoProfile,
  type ConnectionState,
  type Roaster,
  type RoastpilotApi,
} from '@roastpilot/shared';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi, type Mocked } from 'vitest';
import { AppProvider } from '../app/AppProvider';
import { READY_ROAST } from '@roastpilot/shared';
import { createStores, type StoresSeed } from '../stores/stores';

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
        connection: { status: 'disconnected' } as const,
        roast: READY_ROAST,
        readings: [],
        safety: { locked: false, tripped: [] },
        auto: AUTO_OFF,
        setup: NO_ROAST_SETUP,
        currentRoastId: null,
      }),
    ),
    roastAction: vi.fn(() => Promise.resolve(ok(undefined))),
    onRoast: vi.fn(() => unsubscribe),
    getSettings: vi.fn(() => Promise.resolve(DEFAULT_SETTINGS)),
    setSettings: vi.fn((settings) => Promise.resolve(ok(settings))),
    listLogDays: vi.fn(() => Promise.resolve([])),
    readLogDay: vi.fn(() => Promise.resolve({ records: [], unreadable: 0, truncated: false })),
    onLogEntries: vi.fn(() => unsubscribe),
    openLogFolder: vi.fn(() => Promise.resolve()),
    onNavigate: vi.fn(() => unsubscribe),
    listRoasts: vi.fn(() => Promise.resolve([])),
    getRoast: vi.fn((id: number) => Promise.resolve(err({ kind: 'not-found' as const, id }))),
    deleteRoast: vi.fn(() => Promise.resolve(ok(undefined))),
    exportRoastsCsv: vi.fn(() => Promise.resolve(ok({ status: 'cancelled' as const }))),
    importArtisan: vi.fn(() => Promise.resolve(ok({ status: 'cancelled' as const }))),
    onRoastsChanged: vi.fn(() => unsubscribe),
    autoChargeSoon: vi.fn(() => Promise.resolve(ok(undefined))),
    autoResume: vi.fn(() => Promise.resolve(ok(undefined))),
    onAutoStatus: vi.fn(() => unsubscribe),
    listProfiles: vi.fn(() => Promise.resolve([])),
    duplicateProfile: vi.fn((id: string) =>
      Promise.resolve(err({ kind: 'not-found' as const, id })),
    ),
    saveProfile: vi.fn((profile: AutoProfile) => Promise.resolve(ok({ profile, builtIn: false }))),
    deleteProfile: vi.fn(() => Promise.resolve(ok(undefined))),
    copyProfile: vi.fn((request: { id: string }) =>
      Promise.resolve(err({ kind: 'not-found' as const, id: request.id })),
    ),
    listRoasters: vi.fn(() => Promise.resolve([])),
    addRoaster: vi.fn(() => Promise.resolve(err({ kind: 'in-use' as const }))),
    saveRoaster: vi.fn((roaster: Roaster) => Promise.resolve(ok(roaster))),
    deleteRoaster: vi.fn(() => Promise.resolve(ok(undefined))),
    setActiveRoaster: vi.fn(() => Promise.resolve(ok(undefined))),
    chooseConnection: vi.fn(() => Promise.resolve(ok(undefined))),
    onRoasters: vi.fn(() => unsubscribe),
    listBeans: vi.fn(() => Promise.resolve([])),
    addBean: vi.fn(() => Promise.resolve(ok(1))),
    updateBean: vi.fn(() => Promise.resolve(ok(undefined))),
    setBeanArchived: vi.fn(() => Promise.resolve(ok(undefined))),
    addStock: vi.fn(() => Promise.resolve(ok(undefined))),
    adjustStock: vi.fn(() => Promise.resolve(ok(undefined))),
    onBeans: vi.fn(() => unsubscribe),
    setRoastSetup: vi.fn(() => Promise.resolve()),
    saveRoastResult: vi.fn(() => Promise.resolve(ok(undefined))),
    makeProfileFromRoast: vi.fn(() => Promise.resolve(err({ kind: 'too-short' as const }))),
    ...overrides,
  } as Mocked<RoastpilotApi>;
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

/** Renders `ui` with stores already seeded (and ready), and returns the fakes. */
export function renderApp(ui: ReactNode, seed: StoresSeed = {}, api = fakeApi()) {
  const stores = createStores({ ready: true, ...seed });
  const view = render(<AppProvider deps={{ api, stores, logger: silentLogger }}>{ui}</AppProvider>);
  return { ...view, api, stores };
}
