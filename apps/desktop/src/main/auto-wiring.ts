import {
  AutoPilot,
  quantize,
  withSoakTime,
  type AutoEvent,
  type Logger,
  type ManualRoast,
  type RoasterSession,
  type RoastPlan,
} from '@roastpilot/core';
import {
  IPC_CHANNELS,
  type IpcEventChannel,
  type IpcEventPayloads,
  type Reading,
  type RoasterId,
  type RoastSetup,
} from '@roastpilot/shared';
import type { ProfileService } from './profiles/profile-service';
import type { RoasterService } from './roasters/roaster-service';
import type { SettingsService } from './settings/settings-service';

/** How the roast charging now runs, for the saved copy: read once, at charge. */
export function roastPlan(
  settings: Pick<SettingsService, 'latest'>,
  profiles: Pick<ProfileService, 'active'>,
  roasterId: RoasterId,
  setup: RoastSetup,
): RoastPlan {
  const { roastMode, soakTimeS } = settings.latest;
  return roastMode === 'auto'
    ? { mode: 'auto', profile: withSoakTime(profiles.active(), soakTimeS), roasterId, ...setup }
    : { mode: 'manual', profile: null, roasterId, ...setup };
}

function noteAutoEvent(roast: ManualRoast, event: AutoEvent): void {
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
  }
}

/** AutoPilot on the app's own session, flow and settings (docs/spec/roast-control.md, Auto mode). */
export function createAutoPilot({
  session,
  roast,
  settings,
  profiles,
  roasters,
  readings,
  publish,
  logger,
}: {
  session: RoasterSession;
  roast: ManualRoast;
  settings: Pick<SettingsService, 'latest'>;
  profiles: Pick<ProfileService, 'active'>;
  roasters: Pick<RoasterService, 'active'>;
  readings: () => readonly Reading[];
  publish: <C extends IpcEventChannel>(channel: C, payload: IpcEventPayloads[C]) => void;
  logger: Logger;
}): AutoPilot {
  return new AutoPilot({
    roast: () => roast.state,
    readings,
    setOutput: (channel, value) => session.setOutput(channel, value),
    round: (channel, value) => {
      const { connection } = session;
      const output =
        connection.status === 'connected'
          ? connection.channels.find((c) => c.id === channel)
          : undefined;
      return output?.kind === 'output' ? quantize(output, value) : value;
    },
    heaterLocked: () => session.connection.status !== 'connected' || session.safetyStatus.locked,
    drop: async () => {
      const dropped = await roast.act('drop');
      // AutoPilot cuts the heater and stops: it never drives past the end of a roast.
      if (!dropped.ok) throw new Error(`Drop refused: ${dropped.error.kind}`);
    },
    profile: () => profiles.active(),
    tuning: () => roasters.active().tuning,
    soakS: () => settings.latest.soakTimeS,
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
