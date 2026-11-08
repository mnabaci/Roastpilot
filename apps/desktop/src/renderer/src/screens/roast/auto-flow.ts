import {
  formatPlainTemp,
  type AutoProfile,
  type AutoStatus,
  type AutoStopReason,
  type PreheatStep,
  type RoastState,
  type TemperatureUnit,
} from '@roastpilot/shared';
import { formatClock } from '@roastpilot/ui';
import { isAutoDriven } from '../../lib/roast-phases';
import { END_ROAST, type FlowButton, type FlowStep } from './flow-step';

const START: FlowButton = { action: 'start', label: 'Beans in · Start' };
const FIRST_CRACK: FlowButton = { action: 'first-crack', label: 'First crack' };
const DROP: FlowButton = { action: 'drop', label: 'Drop now' };

/** Why Auto stopped, in a few words (docs/spec/roast-control.md, Auto mode). */
export const STOP_REASON: Readonly<Record<AutoStopReason, string>> = {
  'preheat-limit': 'Preheat ran out',
  'heater-locked': 'Heater locked',
  'safety-stop': 'Safety stop',
  lost: 'Connection lost',
  disconnected: 'Roaster disconnected',
  'tick-failed': 'Auto failed',
};

/** What the screen knows that Auto's status doesn't: the clock and the heater. */
export interface AutoFlowLive {
  /** Seconds since your first-crack tap. */
  developmentS?: number | undefined;
  heaterPct?: number | undefined;
  /** What the hints say temperatures in; °C unless given. */
  unit?: TemperatureUnit;
}

/** Auto stopped: why, and what is yours now. Never Start after a preheat ran out: the drum cools. */
function stoppedStep(roast: RoastState, reason: AutoStopReason): FlowStep | undefined {
  const why = STOP_REASON[reason];
  if (roast.phase === 'preheat') {
    return reason === 'preheat-limit'
      ? { stop: END_ROAST, hint: `${why} · heater off · stop, then Preheat again.` }
      : { secondary: START, stop: END_ROAST, hint: `${why} · heater and fan are yours.` };
  }
  if (roast.phase === 'roasting') {
    return { primary: FIRST_CRACK, secondary: DROP, stop: END_ROAST, hint: `${why} · you drop.` };
  }
  if (roast.phase === 'development') {
    return { primary: DROP, stop: END_ROAST, hint: `${why} · you drop.` };
  }
  return undefined;
}

/** Auto turned off mid-roast: the heater stays where it was, and Drop is yours. */
function switchedOffStep(roast: RoastState, heaterPct: number | undefined): FlowStep | undefined {
  const lastMode = roast.events.findLast((e) => e.kind === 'mode');
  if (lastMode?.detail !== 'manual') return undefined;
  const heater = heaterPct === undefined ? 'heater stays' : `heater stays ${String(heaterPct)} %`;
  const hint = `Manual · ${heater} · you drop.`;
  if (roast.phase === 'roasting') {
    return { primary: FIRST_CRACK, secondary: DROP, stop: END_ROAST, hint };
  }
  return roast.phase === 'development' ? { primary: DROP, stop: END_ROAST, hint } : undefined;
}

/** What each preheat step asks of you; Start stays reachable, so you can always go early. */
function preheatStep(step: PreheatStep, leftS: number | null, charge: string): FlowStep {
  const left = leftS === null ? '' : ` ${formatClock(leftS)}`;
  const stop = { stop: END_ROAST };
  switch (step) {
    case 'cool':
      return {
        secondary: START,
        ...stop,
        hint: `Too hot · cooling before the climb to ${charge}.`,
      };
    case 'climb':
      return { secondary: START, ...stop, hint: `Heating to ${charge}.` };
    case 'hold':
      return { secondary: START, ...stop, hint: `Holding ${charge} ·${left} left.` };
    case 'add-beans':
      return {
        chargeSoon: true,
        secondary: START,
        ...stop,
        hint: 'Get the beans ready, then press Charge soon.',
      };
    case 'charge-cut':
      return { primary: START, ...stop, hint: `Heater off · beans in${left}.` };
    case 'beans-in':
      return { primary: START, ...stop, hint: 'Beans in now, and press Start.' };
  }
}

/** One line on what the running step does, in the flow's hint place. */
function roastHint(
  status: AutoStatus,
  profile: AutoProfile,
  unit: TemperatureUnit,
  developmentS?: number,
): string {
  const name = status.phaseName ?? 'Auto';
  if (status.stallTripped) return `${name} · RoR low · more heat`;
  if (developmentS !== undefined) {
    const leftS = Math.max(0, profile.devTimeS - developmentS);
    return `${name} · drops in ${formatClock(leftS)} or at ${formatPlainTemp(profile.capC, unit)}`;
  }
  return status.nextPhaseAtC === null
    ? name
    : `${name} · next at ${formatPlainTemp(status.nextPhaseAtC, unit)}`;
}

/**
 * The flow panel while Auto drives, has stopped, or was turned off mid-roast (docs/spec/
 * roast-control.md, Auto mode); undefined when the normal step applies: a manual roast, or
 * cooling, which Auto leaves alone.
 */
export function autoFlowStep(
  roast: RoastState,
  status: AutoStatus,
  profile: AutoProfile | undefined,
  live: AutoFlowLive = {},
): FlowStep | undefined {
  if (!status.enabled) return switchedOffStep(roast, live.heaterPct);
  if (status.stopReason !== null && isAutoDriven(roast.phase)) {
    return stoppedStep(roast, status.stopReason);
  }
  if (!profile) return undefined;
  const unit = live.unit ?? 'c';
  if (roast.phase === 'ready' || roast.phase === 'done') {
    return {
      primary: { action: 'preheat', label: 'Preheat' },
      hint: `Auto heats to ${formatPlainTemp(profile.chargeC, unit)} and holds · then add beans.`,
    };
  }
  if (roast.phase === 'preheat') {
    return status.preheatStep === null
      ? { secondary: START, stop: END_ROAST, hint: 'Starting the preheat…' }
      : preheatStep(
          status.preheatStep,
          status.preheatLeftS,
          formatPlainTemp(profile.chargeC, unit),
        );
  }
  if (roast.phase === 'roasting') {
    return {
      primary: FIRST_CRACK,
      secondary: DROP,
      stop: END_ROAST,
      hint: roastHint(status, profile, unit),
    };
  }
  if (roast.phase === 'development') {
    return {
      primary: DROP,
      stop: END_ROAST,
      hint: roastHint(status, profile, unit, live.developmentS ?? 0),
    };
  }
  return undefined;
}
