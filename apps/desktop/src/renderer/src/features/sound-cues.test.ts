import { AUTO_OFF } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { listenDue, stepsReached, stillWaiting, type CueState, type WaitState } from './sound-cues';

const state = (
  phase: CueState['roast']['phase'],
  auto: Partial<CueState['auto']> = {},
): CueState => ({ roast: { phase }, auto: { ...AUTO_OFF, enabled: true, ...auto } });

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

  it('Auto stopped waits until the stop reason clears, or you switch to Manual', () => {
    expect(stillWaiting('auto-stopped', at({}, { stopReason: 'disconnected' }))).toBe(true);
    expect(stillWaiting('auto-stopped', at({}))).toBe(false);
    // Manual keeps the reason until Auto is back on, but nothing is waiting for Resume auto.
    expect(
      stillWaiting('auto-stopped', at({}, { enabled: false, stopReason: 'disconnected' })),
    ).toBe(false);
  });
});
