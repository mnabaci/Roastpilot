import type { AutoProfile, AutoTuning, CoachStatus, Reading, RoastState } from '@roastpilot/shared';
import type { Clock } from '../clock';
import type { Logger } from '../logging/logger';
import type { CoachRule } from './coach-rule';

/** What the Coach needs from the app (docs/spec/manual-mode.md, Coach; ADR 0019). */
export interface CoachDeps {
  clock: Clock;
  roast: () => RoastState;
  /** Every reading kept, the newest last. */
  readings: () => readonly Reading[];
  /** The profile picked for Auto, as Auto would run it (cap applied). */
  profile: () => AutoProfile;
  tuning: () => AutoTuning;
  /** A manual roast with "Coach in manual roasts" on. */
  wanted: () => boolean;
  /** Disconnected or locked by a safety stop: nothing to suggest. */
  heaterLocked: () => boolean;
  /** As for the Listen for first crack sound; undefined without saved first cracks. */
  expectedFirstCrackC: () => number | undefined;
  /** Clamps and rounds to what the connected roaster takes. */
  round: (channel: string, value: number) => number;
  /** In order; the first with something to say wins. */
  rules: readonly CoachRule[];
  onChange: (status: CoachStatus) => void;
  logger?: Logger;
}
