import {
  drumOnValue,
  ManualRoast,
  type Clock,
  type Logger,
  type ReadingHistory,
  type RoasterSession,
} from '@roastpilot/core';
import type { RoastState } from '@roastpilot/shared';
import { connectedHasOutput } from './connected-output';
import type { RoasterService } from './roasters/roaster-service';
import type { SettingsService } from './settings/settings-service';

/** The roast flow on the app's own session, readings and settings (docs/spec/manual-mode.md). */
export function createManualRoast({
  clock,
  logger,
  session,
  history,
  settings,
  roasters,
  onChange,
}: {
  clock: Clock;
  logger: Logger;
  session: RoasterSession;
  history: ReadingHistory;
  settings: Pick<SettingsService, 'latest'>;
  roasters: Pick<RoasterService, 'active'>;
  onChange: (state: RoastState) => void;
}): ManualRoast {
  return new ManualRoast({
    clock,
    logger,
    setOutput: (channel, value) => session.setOutput(channel, value),
    latestBt: () => history.latest()?.values.bt,
    readings: () => history.all(),
    canCoolRoaster: () => session.connection.status === 'connected' && !session.safetyStatus.locked,
    hasOutput: (channel) => connectedHasOutput(session.connection, channel),
    options: () => {
      const latest = settings.latest;
      return {
        findChargePoint: latest.findChargePoint,
        coolingMs: latest.coolingTimeMin * 60_000,
        coolRoasterAfter: latest.coolRoasterAfter,
        roasterCoolToC: latest.roasterCoolToC,
        coolerHelpsDrum: roasters.active().coolerHelpsDrum,
        // From the connected roaster's own drum: what it takes for on.
        drumOn: drumOnValue(
          session.connection.status === 'connected' ? session.connection.channels : [],
          roasters.active().drumSpeedPct,
        ),
      };
    },
    onChange,
    onNewRoast: () => {
      history.clear();
    },
    onRoastStarted: (chargedAtMs) => {
      session.roastStarted(chargedAtMs);
    },
    onTurningPoint: (atMs) => {
      session.turningPoint(atMs);
    },
    onRoastEnded: () => {
      session.roastEnded();
    },
  });
}
