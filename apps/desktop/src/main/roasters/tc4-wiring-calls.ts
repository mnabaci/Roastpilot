import type { Logger } from '@roastpilot/core';
import {
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
 * live, and save the wiring, reconnecting when that roaster is the connected one so the new wiring
 * takes over at once.
 */
export function tc4WiringCalls(deps: Tc4WiringDeps) {
  const connected = () => deps.connection().status === 'connected';
  return {
    readInputs: (): Promise<Result<Tc4Inputs, ReadInputsError>> =>
      deps.inputs.read({ connected: connected(), roasting: deps.roasting() }),

    saveWiring: async (request: SaveWiringRequest): Promise<Result<Roaster, SaveWiringError>> => {
      const inUse = connected() && deps.roasters.active().id === request.id;
      const saved = await deps.roasters.saveWiring(request, deps.roasting());
      if (!saved.ok || !inUse) return saved;
      const reconnected = await deps.reconnect();
      // The wiring is saved either way; the connection card shows a failed reconnect.
      if (!reconnected.ok) {
        deps.logger.warn('roasters.wiring-reconnect-failed', { error: reconnected.error });
      }
      return ok(saved.value);
    },
  };
}
