import type { DriverError } from '@roastpilot/shared';

/** One line per way connecting can fail: what happened, then what to try. */
export function connectErrorText(error: DriverError): string {
  switch (error.kind) {
    case 'disconnected':
      return "Couldn't open the port · check the cable, then Refresh";
    case 'no-reply':
      return 'No reply · is SkyCommand flashed and the roaster on?';
    case 'version-mismatch':
      return `Sketch version ${error.actual ?? 'unknown'} · flash the SkyCommand sketch from firmware/`;
    case 'bad-reply':
      return 'Unexpected reply · is this the roaster port?';
    case 'unknown-channel':
    case 'safety-locked':
      return "Couldn't connect · see the log";
  }
}
