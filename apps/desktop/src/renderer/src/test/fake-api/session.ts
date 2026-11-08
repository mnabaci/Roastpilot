import type { AutoApi, CoachApi, RoastApi, RoasterApi, SafetyApi } from '@roastpilot/shared';
import { accepted, done, listening } from './answers';

/** The roaster connection, its outputs and safety: no ports, every request accepted. */
export const fakeRoasterApi = (): RoasterApi & SafetyApi => ({
  listPorts: () => Promise.resolve([]),
  connect: accepted,
  disconnect: done,
  setOutput: accepted,
  onReading: listening,
  onConnection: listening,
  emergencyStop: done,
  acknowledgeSafety: accepted,
  onSafetyEvent: listening,
});

/** The roast itself, Auto and the coach: every request accepted, no status ever sent. */
export const fakeRoastApi = (): RoastApi & AutoApi & CoachApi => ({
  roastAction: accepted,
  onRoast: listening,
  autoChargeSoon: accepted,
  autoResume: accepted,
  onAutoStatus: listening,
  coachApply: accepted,
  coachDismiss: done,
  onCoachStatus: listening,
});
