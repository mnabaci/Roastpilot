import {
  AutoPilot,
  quantize,
  withCapUnder,
  type AutoEvent,
  type Logger,
  type ManualRoast,
  type PreheatHold,
  type RoasterSession,
  type RoastPlan,
} from '@roastpilot/core';
import {
  IPC_CHANNELS,
  type AutoProfile,
  type IpcEventChannel,
  type IpcEventPayloads,
  type Reading,
  type RoasterId,
  type RoastSetup,
} from '@roastpilot/shared';
import type { ProfileService } from './profiles/profile-service';
import type { RoasterService } from './roasters/roaster-service';
import type { SettingsService } from './settings/settings-service';

/** The profile Auto runs: the chosen one, with its cap under the active roaster's max. */
export function autoProfile(
  profiles: Pick<ProfileService, 'active'>,
  roasters: Pick<RoasterService, 'active'>,
): AutoProfile {
  return withCapUnder(profiles.active(), roasters.active().maxTempC);
}

/** How the roast charging now runs, for the saved copy: read at charge, and again if Auto comes on. */
export function roastPlan(
  settings: Pick<SettingsService, 'latest'>,
  profile: () => AutoProfile,
  roasterId: RoasterId,
  setup: RoastSetup,
): RoastPlan {
  return settings.latest.roastMode === 'auto'
    ? { mode: 'auto', profile: profile(), roasterId, ...setup }
    : { mode: 'manual', profile: null, roasterId, ...setup };
}

/** Clamps and rounds an output to what the connected roaster takes; as it is with none connected. */
export function roundOutput(session: Pick<RoasterSession, 'connection'>) {
  return (channel: string, value: number): number => {
    const { connection } = session;
    const output =
      connection.status === 'connected'
        ? connection.channels.find((c) => c.id === channel)
        : undefined;
    return output?.kind === 'output' ? quantize(output, value) : value;
  };
}

/** Disconnected, or locked by a safety stop: neither Auto nor the coach may ask for heat. */
export const heaterLocked = (session: Pick<RoasterSession, 'connection' | 'safetyStatus'>) => () =>
  session.connection.status !== 'connected' || session.safetyStatus.locked;

/** What Auto did, as an event on the roast (docs/spec/data-model.md, Auto mode). */
export function noteAutoEvent(roast: Pick<ManualRoast, 'note'>, event: AutoEvent): void {
  switch (event.kind) {
    case 'phase':
      roast.note('phase', event.name);
      return;
    case 'dry-end':
      roast.note('dry-end');
      return;
    case 'stall-guard':
      roast.note('stall-guard', event.tripped ? 'tripped' : 'cleared');
      return;
    case 'override':
      roast.note('override', `${event.channel} ${String(event.value)}`);
      return;
    case 'mode':
      roast.note('mode', event.auto ? 'auto' : 'manual');
  }
}

/** AutoPilot on the app's own session, flow and profiles (docs/spec/roast-control.md, Auto mode). */
export function createAutoPilot({
  session,
  roast,
  profiles,
  roasters,
  readings,
  preheatHold,
  publish,
  logger,
}: {
  session: RoasterSession;
  roast: ManualRoast;
  profiles: Pick<ProfileService, 'active'>;
  roasters: Pick<RoasterService, 'active'>;
  readings: () => readonly Reading[];
  /** The hold a preheat starting now runs (PreheatHoldPicker). */
  preheatHold: () => PreheatHold;
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
  logger: Logger;
}): AutoPilot {
  return new AutoPilot({
    roast: () => roast.state,
    readings,
    setOutput: (channel, value) => session.setOutput(channel, value),
    round: roundOutput(session),
    heaterLocked: heaterLocked(session),
    drop: async () => {
      const dropped = await roast.act('drop');
      // AutoPilot cuts the heater and stops: it never drives past the end of a roast.
      if (!dropped.ok) throw new Error(`Drop refused: ${dropped.error.kind}`);
    },
    profile: () => autoProfile(profiles, roasters),
    tuning: () => roasters.active().tuning,
    preheatHold,
    onEvent: (event) => {
      // Only a roast has a timeline to put it on: preheat overrides stay in the log.
      if (roast.state.chargedAtMs !== null) noteAutoEvent(roast, event);
    },
    onChange: (status) => {
      publish(IPC_CHANNELS.autoStatus, status);
    },
    logger: logger.child('auto'),
  });
}
