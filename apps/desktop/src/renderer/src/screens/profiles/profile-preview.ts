import { plannedCurve, smoothCurve, timeAtC, withSoakTime } from '@roastpilot/core';
import type { AutoProfile, CurvePoint, ProfilePhase } from '@roastpilot/shared';
import type { ChartLayer, ChartMarker, ChartPoint } from '@roastpilot/ui';
import { PLAN_STEP_S } from '../roast/roast-chart-data';

/** The moment each phase is planned to end. */
function phaseEnd(phase: ProfilePhase, startS: number, curve: readonly CurvePoint[]): number {
  if (phase.next.on === 'time') return startS + phase.next.afterS;
  if (phase.heat.mode === 'target') return startS + phase.heat.durationS;
  if (phase.next.on === 'bt') return timeAtC(curve, phase.next.c) ?? phase.next.backupS;
  return curve.at(-1)?.tS ?? startS;
}

const heatPct = (phase: ProfilePhase) => phase.heat.pct;

/**
 * The Profiles screen's chart: the planned curve dashed, heater and fan as planned steps, and the
 * dry end and planned drop (docs/spec/ui.md, Profiles screen).
 */
export function profilePreview(
  profile: AutoProfile,
  soakS: number,
): { layers: ChartLayer[]; markers: ChartMarker[] } {
  const timed = withSoakTime(profile, soakS);
  // Drawn and timed along the same smooth curve Auto follows.
  const curve = smoothCurve(plannedCurve(timed), PLAN_STEP_S);
  const dropS = curve.at(-1)?.tS ?? 0;
  const heater: ChartPoint[] = [];
  const fan: ChartPoint[] = [];
  let startS = 0;
  for (const phase of timed.phases) {
    heater.push({ t: startS, v: heatPct(phase) });
    fan.push({ t: startS, v: phase.fanPct });
    startS = phaseEnd(phase, startS, curve);
  }
  const last = timed.phases.at(-1);
  if (last) {
    heater.push({ t: dropS, v: heatPct(last) });
    fan.push({ t: dropS, v: last.fanPct });
  }
  const output = (id: string, label: string, tone: 'heat' | 'air', points: ChartPoint[]) =>
    ({ id, label, axis: 'output', tone, width: 2, step: true, points }) as const;
  const dryEndS = timeAtC(curve, profile.dryEndC);
  return {
    layers: [
      {
        id: 'plan',
        label: 'Plan',
        axis: 'temperature',
        tone: 'target',
        width: 2,
        dash: [6, 6],
        points: curve.map((p) => ({ t: p.tS, v: p.c })),
      },
      output('heater', 'Heater', 'heat', heater),
      output('fan', 'Fan', 'air', fan),
    ],
    markers: [
      ...(dryEndS === undefined
        ? []
        : [{ id: 'dry-end', label: 'Dry end', t: dryEndS, tone: 'ink' as const }]),
      { id: 'drop', label: 'Drop', t: dropS, tone: 'ink' },
    ],
  };
}
