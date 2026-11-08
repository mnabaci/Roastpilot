import { diffInText, rateInText, tempInText } from '@roastpilot/shared';
import type { RorTrend } from './ror-trend';

/** One decimal, with a value that rounds to zero shown as 0.0, never -0.0. */
function oneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return (rounded === 0 ? 0 : rounded).toFixed(1);
}

/** A range end as the profile has it: 8, 3.5. */
const plain = (value: number): string => String(Math.round(value * 10) / 10);

// Temperatures go out as tokens: the coach card says them in your unit (sayInUnit).

/** "4 °C below target, RoR falling": a curve phase's gap (BT minus the curve) and the RoR trend. */
export function curveReason(gapC: number, trend: RorTrend | undefined): string {
  const off = Math.round(Math.abs(gapC));
  const gap = off === 0 ? 'On target' : `${diffInText(off)} ${gapC < 0 ? 'below' : 'above'} target`;
  return trend === undefined ? gap : `${gap}, RoR ${trend}`;
}

/** "RoR 6.5 · step wants 8–12": a step phase's RoR against its range. */
export function stepReason(ror: number | undefined, rorMin: number, rorMax: number): string {
  const range = `${rateInText(plain(rorMin))}–${rateInText(plain(rorMax))}`;
  return ror === undefined
    ? `Step wants RoR ${range}`
    : `RoR ${rateInText(oneDecimal(ror))} · step wants ${range}`;
}

/** "Maillard from 150 °C": a phase by its name and the temperature it began at, when known. */
export function phaseReason(name: string, startC: number | undefined): string {
  return startC === undefined ? name : `${name} from ${tempInText(Math.round(startC))}`;
}

/** The stall guard has tripped: that is the reason, whatever the phase. */
export const STALLING = 'RoR stalling';
