import { COACH_QUIET, type CoachStatus } from '@roastpilot/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';

/** The coach card in a manual roast, as main reports it (docs/spec/manual-mode.md, Coach). */
export type CoachStore = StoreApi<{ status: CoachStatus }>;

export const createCoachStore = (status: CoachStatus = COACH_QUIET): CoachStore =>
  createStore(() => ({ status }));
