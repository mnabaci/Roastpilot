import type { AutoPilot, Coach, ManualRoast, RoasterSession } from '@roastpilot/core';
import type { DriverError, Result } from '@roastpilot/shared';

/** Sets one output as you asked for it: a slider, a switch or the coach's Apply. */
export type HandOutput = (channel: string, value: number) => Promise<Result<void, DriverError>>;

/**
 * The one way an output you set reaches the roaster: the roast flow, Auto and the coach hear of
 * it first, then the guarded session sends it, so every safety rule applies.
 */
export function handOutput({
  session,
  roast,
  pilot,
  coach,
}: {
  session: Pick<RoasterSession, 'setOutput'>;
  roast: Pick<ManualRoast, 'outputRequested'>;
  pilot: Pick<AutoPilot, 'outputRequested'>;
  coach: Pick<Coach, 'outputRequested'>;
}): HandOutput {
  return (channel, value) => {
    roast.outputRequested(channel, value);
    pilot.outputRequested(channel, value);
    coach.outputRequested(channel, value);
    return session.setOutput(channel, value);
  };
}
