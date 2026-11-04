import { COMPUTER_SLEEP, type Logger } from '@roastpilot/core';
import type { ConnectionState, RoastPhase, RoastState } from '@roastpilot/shared';

/** Electron's powerSaveBlocker, narrowed to what the guard uses. */
export interface SleepBlocker {
  start(type: 'prevent-app-suspension' | 'prevent-display-sleep'): number;
  stop(id: number): void;
}

export interface PowerGuardDeps {
  blocker: SleepBlocker;
  /** Safe stop with the heater locked, under the computer-sleep rule. */
  emergencyStop: (rule: typeof COMPUTER_SLEEP) => void;
  logger: Logger;
}

export interface PowerGuard {
  onConnection(state: ConnectionState): void;
  /** Every roast change: the screen stays on while a roast runs. */
  onRoast(state: RoastState): void;
  /** The computer is going to sleep anyway (lid closed, sleep chosen from the menu). */
  onSuspend(): void;
  onResume(): void;
}

/** Preheat to Cooling: a roast is running and you are watching it. */
const ROAST_RUNNING: readonly RoastPhase[] = ['preheat', 'roasting', 'development', 'cooling'];

/** One blocker of one kind, held while `on` is true; logs as it turns on and off. */
function holdWhile(
  blocker: SleepBlocker,
  type: Parameters<SleepBlocker['start']>[0],
  logger: Logger,
  event: string,
): (on: boolean) => void {
  let id: number | undefined;
  return (on) => {
    if (on && id === undefined) {
      id = blocker.start(type);
      logger.info(`${event}-on`);
    } else if (!on && id !== undefined) {
      blocker.stop(id);
      id = undefined;
      logger.info(`${event}-off`);
    }
  };
}

/**
 * Keeps the computer from idle sleep while a roaster is connected, and the screen on while a roast
 * runs, so it doesn't lock; safe-stops if the computer sleeps anyway (docs/spec/safety.md,
 * Computer sleep): asleep, nothing watches the roaster.
 */
export function createPowerGuard({ blocker, emergencyStop, logger }: PowerGuardDeps): PowerGuard {
  const keepAwake = holdWhile(blocker, 'prevent-app-suspension', logger, 'power.keep-awake');
  const keepScreenOn = holdWhile(blocker, 'prevent-display-sleep', logger, 'power.screen-on');
  let roasterInUse = false;
  return {
    onConnection(state) {
      roasterInUse = state.status !== 'disconnected';
      keepAwake(roasterInUse);
    },
    onRoast(state) {
      keepScreenOn(ROAST_RUNNING.includes(state.phase) || state.roasterCoolingSinceMs !== null);
    },
    onSuspend() {
      logger.warn('power.suspend', { roasterInUse });
      if (roasterInUse) emergencyStop(COMPUTER_SLEEP);
    },
    onResume() {
      logger.info('power.resume', { roasterInUse });
    },
  };
}
