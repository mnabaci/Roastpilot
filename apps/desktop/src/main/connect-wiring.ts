import type { Clock, Logger, RoasterDriver, RoasterSession } from '@roastpilot/core';
import {
  isRoastRunning,
  ok,
  type ConnectError,
  type ConnectTarget,
  type Result,
  type RoastState,
} from '@roastpilot/shared';
import { createDriver } from './driver-factory';
import type { IpcDeps } from './ipc-deps';
import { RoasterInputs } from './roasters/roaster-inputs';
import type { RoasterService } from './roasters/roaster-service';
import { tc4WiringCalls } from './roasters/tc4-wiring-calls';

export interface ConnectWiringDeps {
  roasters: RoasterService;
  session: RoasterSession;
  roast: { readonly state: RoastState };
  /** Wraps a Simulator driver so its beans follow the roast (simulator-beans.ts). */
  attach: (driver: RoasterDriver) => RoasterDriver;
  clock: Clock;
  logger: Logger;
}

/**
 * What Connect needs: the active roaster's driver, built from its model and record (docs/spec/
 * roasters.md), and a generic TC4's live inputs and wiring save, which reconnects it.
 */
export function connectWiring(deps: ConnectWiringDeps): Pick<IpcDeps, 'createDriver' | 'tc4'> {
  const { roasters, session, roast, attach, clock, logger } = deps;
  const inputs = new RoasterInputs();
  const build = (target: ConnectTarget): Result<RoasterDriver, ConnectError> => {
    const made = createDriver(
      roasters.active(),
      target,
      { clock, logger: logger.child('driver') },
      (driver) => {
        inputs.attach(driver);
      },
    );
    return made.ok ? ok(attach(made.value)) : made;
  };
  const tc4 = tc4WiringCalls({
    roasters,
    inputs,
    connection: () => session.connection,
    roasting: () => isRoastRunning(roast.state),
    reconnect: async () => {
      const { connection } = session;
      if (connection.status === 'disconnected') return ok(undefined);
      const driver = build(connection.target);
      return driver.ok ? session.connect(driver.value, connection.target) : driver;
    },
    logger: logger.child('roasters'),
  });
  return { createDriver: build, tc4 };
}
