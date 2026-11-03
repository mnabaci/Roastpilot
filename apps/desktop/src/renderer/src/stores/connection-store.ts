import type { ConnectionState } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

/** The roaster connection, as main reports it. */
export type ConnectionStore = StoreApi<{ connection: ConnectionState }>;

export const createConnectionStore = (
  connection: ConnectionState = { status: 'disconnected' },
): ConnectionStore => createStore(() => ({ connection }));
