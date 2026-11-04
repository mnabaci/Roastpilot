import {
  err,
  ok,
  type LogEntry,
  type Reading,
  type RoastAction,
  type RoastState,
} from '@roastpilot/shared';
import { ManualClock } from '../clock';
import { createLogger } from '../logging/logger';
import { DEFAULT_COOLING_MS, ManualRoast, type RoastOptions } from './manual-roast';

export interface HarnessOptions {
  failOutputs?: boolean;
  options?: Partial<RoastOptions>;
  /** Whether the roaster can take a cool-down (connected, no safety stop); true by default. */
  canCoolRoaster?: boolean;
}

/**
 * A ManualRoast on a fake clock for tests: records what it sends, signals and logs, and feeds
 * readings the way main does (kept first, then handed to the roast).
 */
export function manualRoastHarness({
  failOutputs = false,
  options = {},
  canCoolRoaster = true,
}: HarnessOptions = {}) {
  const clock = new ManualClock();
  const sent: string[] = [];
  const signals: string[] = [];
  const states: RoastState[] = [];
  const entries: LogEntry[] = [];
  const readings: Reading[] = [];
  let bt: number | undefined = 25;
  const roast = new ManualRoast({
    clock,
    setOutput: (channel, value) => {
      sent.push(`${channel}=${String(value)}`);
      return Promise.resolve(failOutputs ? err({ kind: 'disconnected' }) : ok(undefined));
    },
    latestBt: () => bt,
    readings: () => readings,
    onChange: (s) => states.push(s),
    onNewRoast: () => {
      readings.length = 0;
      signals.push('new-roast');
    },
    onRoastStarted: (atMs) => signals.push(`roast-started@${String(atMs)}`),
    onRoastEnded: () => signals.push('roast-ended'),
    options: () => ({
      findChargePoint: true,
      coolingMs: DEFAULT_COOLING_MS,
      coolRoasterAfter: true,
      ...options,
    }),
    canCoolRoaster: () => canCoolRoaster,
    logger: createLogger({ write: (e) => entries.push(e) }, 'roast'),
  });
  const act = (...actions: RoastAction[]) =>
    actions.reduce<Promise<unknown>>((p, a) => p.then(() => roast.act(a)), Promise.resolve());
  /** One reading a second from the clock's current time, each kept and then handed to the roast. */
  const feed = async (bts: readonly number[]) => {
    for (const value of bts) {
      clock.advance(1000);
      const reading = { atMs: clock.now(), values: { bt: value } };
      readings.push(reading);
      bt = value;
      await roast.onReading(reading);
    }
  };
  return {
    clock,
    roast,
    sent,
    signals,
    states,
    entries,
    readings,
    act,
    feed,
    setBt: (value: number | undefined) => {
      bt = value;
    },
    events: (event: string) => entries.filter((e) => e.event === event),
  };
}
