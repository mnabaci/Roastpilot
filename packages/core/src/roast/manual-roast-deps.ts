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
  /** Drop: the roast is over for the max-roast-time rule. */
  onRoastEnded: () => void;
  options?: () => RoastOptions;
  /** Connected and not locked by a safety stop: only then may the roaster cool-down start. */
  canCoolRoaster?: () => boolean;
  logger?: Logger;
}
