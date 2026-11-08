import { PROFILE_LIMITS, type ProfilePhase } from '@roastpilot/shared';
import { lengthS, roundedC, type Point, type Stretch } from './run-stretches';

const ROR_MARGIN = 1;
const BACKUP_MARGIN_S = 60;

export type ProfileStyle = 'steps' | 'curve';

const averageHeat = (s: Stretch) => {
  const length = lengthS(s);
  return Math.round(length > 0 ? s.heatArea / length : s.from.heater);
};

/**
 * A phase for one stretch of the run. Its time runs from `startedS`, when Auto starts it: the
 * first step starts at the end of the soak, or at charge, even though it is read from the dip on.
 */
function phaseFrom(
  name: string,
  stretch: Stretch,
  style: ProfileStyle,
  next: ProfilePhase['next'],
  startedS = stretch.from.tS,
): ProfilePhase {
  const durationS = Math.min(
    Math.max(Math.round(stretch.to.tS - Math.min(startedS, stretch.from.tS)), 1),
    PROFILE_LIMITS.durationS.max,
  );
  const ror = ((stretch.to.bt - stretch.from.bt) / Math.max(lengthS(stretch), 1)) * 60;
  const pct = averageHeat(stretch);
  return {
    name,
    fanPct: stretch.fan,
    next,
    heat:
      style === 'curve'
        ? { mode: 'follow', pct }
        : {
            mode: 'target',
            pct,
            endC: roundedC(stretch),
            durationS,
            rorMin: Math.round(ror) - ROR_MARGIN,
            rorMax: Math.round(ror) + ROR_MARGIN,
          },
  };
}

/** What the phases are made from: a saved roast cut into soak, steps and development. */
export interface RunCut {
  first: Point;
  /** How long the heater stayed off after charge; 0 when it was on from charge. */
  soakS: number;
  steps: Stretch[];
  development: Stretch;
}

/**
 * Soak at heater 0 when the roast had one, a phase per step, then development until the end rule.
 * With the heater on from charge, the first step starts at charge.
 */
export function runPhases(
  { first, soakS, steps, development }: RunCut,
  style: ProfileStyle,
): ProfilePhase[] {
  const afterS = Math.round(soakS);
  const soak: ProfilePhase[] =
    afterS > 0
      ? [
          {
            name: 'Soak',
            heat: { mode: 'fixed', pct: 0 },
            fanPct: first.fan,
            next: { on: 'time', afterS },
          },
        ]
      : [];
  return [
    ...soak,
    ...steps.map((step, index) =>
      phaseFrom(
        `Step ${String(index + 1)}`,
        step,
        style,
        { on: 'bt', c: roundedC(step), backupS: Math.round(step.to.tS) + BACKUP_MARGIN_S },
        index === 0 ? afterS : step.from.tS,
      ),
    ),
    phaseFrom('Development', development, style, { on: 'end' }),
  ];
}
