import type { SafetyEvent } from '@roastpilot/shared';
import type { Logger } from '../logging/logger';

/** A safe-stop trip is an error, an alarm a warning; clears and unlocks are info. */
export function logSafetyEvent(logger: Logger, event: SafetyEvent): void {
  if (event.kind === 'tripped') {
    const context = { rule: event.rule, action: event.action };
    if (event.action === 'safe-stop') logger.error('safety.tripped', context);
    else logger.warn('safety.tripped', context);
  } else if (event.kind === 'cleared') {
    logger.info('safety.cleared', { rule: event.rule });
  } else {
    logger.info('safety.unlocked');
  }
}
