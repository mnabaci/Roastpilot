import { DEFAULT_SAFETY_LIMITS, RoasterSession, type Clock, type Logger } from '@roastpilot/core';
import type { RoasterService } from './roasters/roaster-service';
import { sessionHandlers, type SessionHandlerDeps } from './session-handlers';

/** The roaster session, with the active roaster's limits, telling the rest of main what happens. */
export function createSession({
  clock,
  logger,
  roasters,
  handlers,
}: {
  clock: Clock;
  logger: Logger;
  roasters: Pick<RoasterService, 'active'>;
  handlers: SessionHandlerDeps;
}): RoasterSession {
  return new RoasterSession({
    clock,
    logger: logger.child('session'),
    limits: () => {
      const { maxTempC, maxTimeS } = roasters.active();
      return { ...DEFAULT_SAFETY_LIMITS, maxTempC, maxRoastMs: maxTimeS * 1000 };
    },
    tempOffsetC: () => roasters.active().tempOffsetC,
    ...sessionHandlers(handlers),
  });
}
