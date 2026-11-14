import type { Logger } from '@roastpilot/core';
import {
  err,
  ok,
  type ConnectError,
  type ConnectionState,
  type ReadInputsError,
  type Result,
  type Roaster,
  type SaveWiringError,
  type SaveWiringRequest,
  type Tc4Inputs,
} from '@roastpilot/shared';
import type { RoasterInputs } from './roaster-inputs';
import type { RoasterService } from './roaster-service';

export interface Tc4WiringDeps {
  roasters: Pick<RoasterService, 'saveWiring' | 'active'>;
  inputs: Pick<RoasterInputs, 'read'>;
  connection: () => ConnectionState;
  /** A roast or drum cooling is running (`isRoastRunning`). */
  roasting: () => boolean;
  /** Connects the active roaster again to the same target, with its new driver. */
  reconnect: () => Promise<Result<void, ConnectError>>;
  logger: Logger;
}

/**
 * The Roasters page's generic TC4 calls (docs/spec/roasters.md, Generic TC4): read every input
 * live, and save the wiring, reconnecting when that roaster is in use (connected, connecting or
 * lost and retrying), so the new wiring takes over at once.
 */
export function tc4WiringCalls(deps: Tc4WiringDeps) {
  const connected = () => deps.connection().status === 'connected';
  const inUse = () => deps.connection().status !== 'disconnected';
  return {
    readInputs: (): Promise<Result<Tc4Inputs, ReadInputsError>> =>
      deps.inputs.read({ connected: connected(), roasting: deps.roasting() }),

    saveWiring: async (request: SaveWiringRequest): Promise<Result<Roaster, SaveWiringError>> => {
      const applies = inUse() && deps.roasters.active().id === request.id;
      const saved = await deps.roasters.saveWiring(request, deps.roasting());
      if (!saved.ok || !applies) return saved;
      // A roast started while it saved: never safe-stop it; the wiring applies on the next Connect.
      if (deps.roasting()) {
        deps.logger.info('roasters.wiring-reconnect-deferred', { id: request.id });
        return saved;
      }
      const reconnected = await deps.reconnect();
      if (reconnected.ok) return ok(saved.value);
      deps.logger.warn('roasters.wiring-reconnect-failed', { error: reconnected.error });
      return err({ kind: 'reconnect-failed', error: reconnected.error });
    },
  };
}
