import type { AutoProfile, AutoStatus, PreheatStep, RoastState } from '@roastpilot/shared';
import { formatClock } from '@roastpilot/ui';
import { END_ROAST, type FlowButton, type FlowStep } from './flow-step';

const START: FlowButton = { action: 'start', label: 'Beans in · Start' };

/** What each preheat step asks of you; Start stays reachable, so you can always go early. */
function preheatStep(step: PreheatStep, leftS: number | null, chargeC: number): FlowStep {
  const left = leftS === null ? '' : ` ${formatClock(leftS)}`;
  const stop = { stop: END_ROAST };
  switch (step) {
    case 'cool':
      return {
        secondary: START,
        ...stop,
        hint: `Too hot · cooling before the climb to ${String(chargeC)} °C.`,
      };
    case 'climb':
      return { secondary: START, ...stop, hint: `Heating to ${String(chargeC)} °C.` };
    case 'hold':
      return { secondary: START, ...stop, hint: `Holding ${String(chargeC)} °C ·${left} left.` };
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
function roastHint(status: AutoStatus, profile: AutoProfile, developing: boolean): string {
  const name = status.phaseName ?? 'Auto';
  if (status.stallTripped) return `${name} · RoR low · fan held`;
  if (developing) {
    return `${name} · drops at ${formatClock(profile.devTimeS)} or ${String(profile.capC)} °C`;
  }
  return status.nextPhaseAtC === null
    ? name
    : `${name} · next at ${String(status.nextPhaseAtC)} °C`;
}

/**
 * The flow panel while Auto drives (docs/spec/roast-control.md, Auto mode); undefined when the
 * normal step applies: Auto off or stopped, or cooling, which Auto leaves alone.
 */
export function autoFlowStep(
  roast: RoastState,
  status: AutoStatus,
  profile: AutoProfile | undefined,
): FlowStep | undefined {
  if (!status.enabled || status.stopped || !profile) return undefined;
  if (roast.phase === 'ready' || roast.phase === 'done') {
    return {
      primary: { action: 'preheat', label: 'Preheat' },
      hint: `Auto heats to ${String(profile.chargeC)} °C and holds · then add beans.`,
    };
  }
  if (roast.phase === 'preheat') {
    return status.preheatStep === null
      ? { secondary: START, stop: END_ROAST, hint: 'Starting the preheat…' }
      : preheatStep(status.preheatStep, status.preheatLeftS, profile.chargeC);
  }
  if (roast.phase === 'roasting') {
    return {
      primary: { action: 'first-crack', label: 'First crack' },
      secondary: { action: 'drop', label: 'Drop now' },
      stop: END_ROAST,
      hint: roastHint(status, profile, false),
    };
  }
  if (roast.phase === 'development') {
    return {
      primary: { action: 'drop', label: 'Drop now' },
      stop: END_ROAST,
      hint: roastHint(status, profile, true),
    };
  }
  return undefined;
}
