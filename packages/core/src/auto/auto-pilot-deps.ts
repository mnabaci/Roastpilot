import type {
  AutoProfile,
  AutoStatus,
  AutoTuning,
  DriverError,
  Reading,
  Result,
  RoastState,
} from '@roastpilot/shared';
import type { Logger } from '../logging/logger';
import type { PreheatHold } from './preheat-hold';
import type { AutoEvent } from './roast-run';

/** What AutoPilot needs from the app (docs/spec/roast-control.md, Auto mode). */
export interface AutoPilotDeps {
  roast: () => RoastState;
  readings: () => readonly Reading[];
  /** The guarded driver's path, so every command passes the safety rules. */
  setOutput: (channel: string, value: number) => Promise<Result<void, DriverError>>;
  /** Clamps and rounds to what the connected roaster takes. */
  round: (channel: string, value: number) => number;
  heaterLocked: () => boolean;
  /** Asks the flow to Drop, so cooling and saving stay in one place. Throws if it can't. */
  drop: () => Promise<void>;
  profile: () => AutoProfile;
  tuning: () => AutoTuning;
  /**
   * The hold a preheat starting now runs, picked for the batch (`pickPreheatHold`,
   * docs/spec/roast-control.md, Roast phases 1.3); your choice for the roast goes on top.
   */
  preheatHold: () => PreheatHold;
  onEvent: (event: AutoEvent) => void;
  onChange: (status: AutoStatus) => void;
  logger?: Logger;
}
