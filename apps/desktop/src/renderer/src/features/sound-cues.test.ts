import { AUTO_OFF, type RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import {
  expectedFirstCrackC,
  listenDue,
  stepsReached,
  stillWaiting,
  type CueState,
  type WaitState,
} from './sound-cues';

const state = (
  phase: CueState['roast']['phase'],
  auto: Partial<CueState['auto']> = {},
): CueState => ({ roast: { phase }, auto: { ...AUTO_OFF, enabled: true, ...auto } });

const roast = (
  id: number,
  fcTemp: number | null,
  roasterId: number | null = 1,
): Pick<RoastSummary, 'id' | 'startedAt' | 'fcTemp' | 'roasterId'> => ({
  id,
  // A higher id is a newer roast.
  startedAt: `2026-11-${String(id).padStart(2, '0')}T09:00:00.000Z`,
  fcTemp,
  roasterId,
});
const list = (...roasts: ReturnType<typeof roast>[]) => roasts as RoastSummary[];

describe('stepsReached', () => {
  it('Charge soon when Auto says add beans, then Beans in, once each', () => {
    const hold = state('preheat', { preheatStep: 'hold' });
    const addBeans = state('preheat', { preheatStep: 'add-beans' });
    const beansIn = state('preheat', { preheatStep: 'beans-in' });
    expect(stepsReached(hold, addBeans)).toEqual(['charge-soon']);
    expect(stepsReached(addBeans, addBeans)).toEqual([]);
    expect(stepsReached(addBeans, beansIn)).toEqual(['beans-in']);
    expect(stepsReached(state('preheat'), state('preheat', { preheatStep: 'charge-cut' }))).toEqual(
      [],
    );
  });

  it('no preheat step while Auto is off', () => {
    const off = { enabled: false, preheatStep: 'add-beans' } as const;
    expect(stepsReached(state('preheat'), state('preheat', off))).toEqual([]);
  });

  it('Dump beans when the beans start cooling', () => {
    expect(stepsReached(state('development'), state('cooling'))).toEqual(['dump-beans']);
    expect(stepsReached(state('cooling'), state('cooling'))).toEqual([]);
  });

  it('Auto stopped when Auto stops mid-run, but not for a safety trip', () => {
    const lost = { stopReason: 'lost' } as const;
    expect(stepsReached(state('roasting'), state('roasting', lost))).toEqual(['auto-stopped']);
    expect(stepsReached(state('roasting', lost), state('roasting', lost))).toEqual([]);
    expect(
      stepsReached(state('preheat'), state('preheat', { stopReason: 'preheat-limit' })),
    ).toEqual(['auto-stopped']);
    expect(
      stepsReached(state('roasting'), state('roasting', { stopReason: 'safety-stop' })),
    ).toEqual([]);
    expect(
      stepsReached(state('development'), state('development', { stopReason: 'heater-locked' })),
    ).toEqual([]);
  });

  it('no Auto stopped outside the phases Auto drives', () => {
    expect(stepsReached(state('ready'), state('ready', { stopReason: 'disconnected' }))).toEqual(
      [],
    );
  });
});

describe('expectedFirstCrackC', () => {
  it('is the median BT at first crack of the last 5 roasts that had one', () => {
    const roasts = list(
      roast(1, 150), // sixth newest with a crack: left out
      roast(2, 196),
      roast(3, 194),
      roast(4, null),
      roast(5, 198),
      roast(6, 195),
      roast(7, 200),
    );
    expect(expectedFirstCrackC(roasts, 1)).toBe(196);
  });

  it('averages the two middle ones of an even count', () => {
    expect(expectedFirstCrackC(list(roast(1, 194), roast(2, 198)), 1)).toBe(196);
  });

  it("prefers this roaster's roasts, and falls back on all of them", () => {
    const roasts = list(roast(1, 190, 1), roast(2, 205, 2));
    expect(expectedFirstCrackC(roasts, 2)).toBe(205);
    expect(expectedFirstCrackC(roasts, 3)).toBe(197.5);
    expect(expectedFirstCrackC(roasts, undefined)).toBe(197.5);
  });

  it('is undefined without a saved first crack', () => {
    expect(expectedFirstCrackC([], 1)).toBeUndefined();
    expect(expectedFirstCrackC(list(roast(1, null)), 1)).toBeUndefined();
  });
});

describe('listenDue', () => {
  const roasting = { phase: 'roasting', firstCrackAtMs: null } as const;

  it('is due from 3 °C under the expected first crack', () => {
    expect(listenDue(roasting, 192.9, 196)).toBe(false);
    expect(listenDue(roasting, 193, 196)).toBe(true);
  });

  it('is not due after the first-crack tap, outside Roasting, or with nothing to go on', () => {
    expect(listenDue({ phase: 'roasting', firstCrackAtMs: 1 }, 199, 196)).toBe(false);
    expect(listenDue({ phase: 'preheat', firstCrackAtMs: null }, 199, 196)).toBe(false);
    expect(listenDue(roasting, undefined, 196)).toBe(false);
    expect(listenDue(roasting, 199, undefined)).toBe(false);
  });
});

describe('stillWaiting', () => {
  const at = (
    roast: Partial<WaitState['roast']>,
    auto: Partial<WaitState['auto']> = {},
  ): WaitState => ({
    roast: { phase: 'preheat', firstCrackAtMs: null, ...roast },
    auto: { ...AUTO_OFF, enabled: true, ...auto },
  });

  it('Charge soon and Beans in wait while Auto is on that preheat step', () => {
    expect(stillWaiting('charge-soon', at({}, { preheatStep: 'add-beans' }))).toBe(true);
    expect(stillWaiting('charge-soon', at({}, { preheatStep: 'beans-in' }))).toBe(false);
    expect(stillWaiting('charge-soon', at({}, { enabled: false, preheatStep: 'add-beans' }))).toBe(
      false,
    );
    expect(stillWaiting('beans-in', at({}, { preheatStep: 'beans-in' }))).toBe(true);
    expect(stillWaiting('beans-in', at({ phase: 'roasting' }, { preheatStep: null }))).toBe(false);
  });

  it('Listen waits while Roasting with no crack; Dump beans while Cooling', () => {
    expect(stillWaiting('listen-first-crack', at({ phase: 'roasting' }))).toBe(true);
    expect(stillWaiting('listen-first-crack', at({ phase: 'roasting', firstCrackAtMs: 5 }))).toBe(
      false,
    );
    expect(stillWaiting('listen-first-crack', at({ phase: 'development' }))).toBe(false);
    expect(stillWaiting('dump-beans', at({ phase: 'cooling' }))).toBe(true);
    expect(stillWaiting('dump-beans', at({ phase: 'ready' }))).toBe(false);
  });

  it('Auto stopped waits until the stop reason clears', () => {
    expect(stillWaiting('auto-stopped', at({}, { stopReason: 'disconnected' }))).toBe(true);
    expect(stillWaiting('auto-stopped', at({}))).toBe(false);
  });
});
