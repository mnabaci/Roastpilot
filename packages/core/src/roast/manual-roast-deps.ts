import type { DriverError, Reading, Result, RoastState } from '@roastpilot/shared';
import type { Clock } from '../clock';
import type { Logger } from '../logging/logger';
import type { RoastOptions } from './roast-rules';

/** What ManualRoast needs from the app (docs/spec/manual-mode.md). */
export interface ManualRoastDeps {
  clock: Clock;
  setOutput: (channel: string, value: number) => Promise<Result<void, DriverError>>;
  /** Latest bean temperature, for event records. */
  latestBt: () => number | undefined;
  /** Readings kept since Preheat, oldest first: for the charge point and the turning point. */
  readings?: () => readonly Reading[];
  onChange: (state: RoastState) => void;
  /** Preheat began: a new roast, so earlier readings can go. */
  onNewRoast: () => void;
  /** Charge (at the charge point): arms the max-roast-time rule. */
  onRoastStarted: (chargedAtMs: number) => void;
  /** The turning point was found: the stall alarm watches from here. */
  onTurningPoint?: (atMs: number) => void;
  /** Drop: the roast is over for the max-roast-time rule. */
  onRoastEnded: () => void;
  options?: () => RoastOptions;
  /**
   * Whether the connected roaster has this output: the flow's steps send nothing to one it lacks
   * (a bean cooler or drum on a generic TC4; docs/spec/roasters.md). Every output when left out.
   */
  hasOutput?: (channel: string) => boolean;
  /** Connected and not locked by a safety stop: only then may drum cooling start. */
  canCoolRoaster?: () => boolean;
  logger?: Logger;
}
