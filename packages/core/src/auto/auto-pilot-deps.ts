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
  onEvent: (event: AutoEvent) => void;
  onChange: (status: AutoStatus) => void;
  logger?: Logger;
}
