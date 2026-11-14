import type { ConnectError, RoasterModelFacts } from '@roastpilot/shared';

/**
 * One line per way connecting can fail: what happened, then what to try, in the words of the
 * roaster's own firmware (SkyCommand, aArtisanQ_PID).
 */
export function connectErrorText(
  error: ConnectError,
  model: Pick<RoasterModelFacts, 'firmware' | 'wiring'>,
): string {
  const firmware = model.firmware ?? 'the firmware';
  switch (error.kind) {
    case 'disconnected':
      return "Couldn't open the port · check the cable, then Refresh";
    case 'no-reply':
      return model.wiring
        ? `No reply · check the baud, and that ${firmware} is flashed`
        : `No reply · is ${firmware} flashed and the roaster on?`;
    case 'version-mismatch':
      // No version at all means the board didn't answer, not that it runs another sketch.
      return error.actual === null
        ? `No reply from the roaster · check the cables and ground, then reflash ${firmware}`
        : `Sketch version ${String(error.actual)} · flash the ${firmware} sketch from firmware/`;
    case 'bad-reply':
      return model.wiring
        ? `Unexpected reply · check the baud and the ${firmware} firmware`
        : 'Unexpected reply · is this the roaster port?';
    // wrong-connection: Connect always uses the active roaster's own connection, so it is a bug.
    case 'unknown-channel':
    case 'safety-locked':
    case 'wrong-connection':
      return "Couldn't connect · see the log";
  }
}
