import type { RoastState } from '@roastpilot/shared';

/** What may be running that the wiring waits for (`isRoastRunning` split in its two causes). */
export interface WiringWait {
  roasting: boolean;
  drumCooling: boolean;
  /** The roaster in use, when it isn't the one on this page. */
  otherName: string | undefined;
}

export const wiringWait = (roast: RoastState, otherName: string | undefined): WiringWait => ({
  roasting: roast.phase !== 'ready' && roast.phase !== 'done',
  drumCooling: roast.roasterCoolingSinceMs !== null,
  otherName,
});

/** The card's one line under its title: when picks save, or what they wait for. */
export function wiringStatus(wait: WiringWait, connected: boolean): string {
  if (wait.roasting) {
    return wait.otherName
      ? `Waits until ${wait.otherName}'s roast ends`
      : 'Waits until the roast ends';
  }
  if (wait.drumCooling) {
    return wait.otherName
      ? `Waits until ${wait.otherName}'s drum has cooled`
      : 'Waits until the drum has cooled';
  }
  return connected ? 'Saves as you pick · reconnects the roaster' : 'Saves as you pick';
}

export const isWaiting = (wait: WiringWait) => wait.roasting || wait.drumCooling;
