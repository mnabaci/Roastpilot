import type { ConnectError } from '@roastpilot/shared';

/** One line per way connecting can fail: what happened, then what to try. */
export function connectErrorText(error: ConnectError): string {
  switch (error.kind) {
    case 'disconnected':
      return "Couldn't open the port · check the cable, then Refresh";
    case 'no-reply':
      return 'No reply · is SkyCommand flashed and the roaster on?';
    case 'version-mismatch':
      // No version at all means the board didn't answer, not that it runs another sketch.
      return error.actual === null
        ? 'No reply from the roaster · check the cables and ground, then reflash SkyCommand'
        : `Sketch version ${String(error.actual)} · flash the SkyCommand sketch from firmware/`;
    case 'bad-reply':
      return 'Unexpected reply · is this the roaster port?';
    // wrong-connection: Connect always uses the active roaster's own connection, so it is a bug.
    case 'unknown-channel':
    case 'safety-locked':
    case 'wrong-connection':
      return "Couldn't connect · see the log";
  }
}
