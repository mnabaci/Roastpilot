import { COMPUTER_SLEEP, type Logger } from '@roastpilot/core';
import type { ConnectionState } from '@roastpilot/shared';

/** Electron's powerSaveBlocker, narrowed to what the guard uses. */
export interface SleepBlocker {
  start(type: 'prevent-app-suspension'): number;
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
  /** The computer is going to sleep anyway (lid closed, sleep chosen from the menu). */
  onSuspend(): void;
  onResume(): void;
}

/**
 * Keeps the computer from idle sleep while a roaster is connected, and safe-stops if it sleeps
 * anyway (docs/spec/safety.md, Computer sleep): asleep, nothing watches the roaster.
 */
export function createPowerGuard({ blocker, emergencyStop, logger }: PowerGuardDeps): PowerGuard {
  let blockId: number | undefined;
  let roasterInUse = false;
  return {
    onConnection(state) {
      roasterInUse = state.status !== 'disconnected';
      if (roasterInUse && blockId === undefined) {
        blockId = blocker.start('prevent-app-suspension');
        logger.info('power.keep-awake-on');
      } else if (!roasterInUse && blockId !== undefined) {
        blocker.stop(blockId);
        blockId = undefined;
        logger.info('power.keep-awake-off');
      }
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
