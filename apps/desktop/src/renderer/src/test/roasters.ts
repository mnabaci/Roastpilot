import {
  CURVE_FOLLOW_DEFAULTS,
  DEFAULT_TC4_WIRING,
  type ConnectTarget,
  type Roaster,
} from '@roastpilot/shared';

const TUNING = {
  target: { kp: 1.5, ki: 0.02, kd: 0 },
  targetLimitPct: 20,
  curveFollow: CURVE_FOLLOW_DEFAULTS,
  preheat: { kp: 5, ki: 0.02, kd: 0 },
  preheatFanPct: 30,
  holdS: 150,
  nextHoldS: 120,
  chargeCutS: 5,
};

export const SKYWALKER: Roaster = {
  id: 1,
  name: 'Skywalker',
  model: 'skywalker',
  connection: null,
  batchMinG: 250,
  batchIdealG: 375,
  batchMaxG: 400,
  maxTempC: 240,
  maxTimeS: 1200,
  tempOffsetC: 0,
  coolerHelpsDrum: true,
  drumSpeedPct: 60,
  tuning: TUNING,
  wiring: null,
  minFanHeatingPct: 0,
  active: true,
};

export const SIMULATOR: Roaster = {
  ...SKYWALKER,
  id: 2,
  name: 'Simulator',
  model: 'simulator',
  connection: { kind: 'simulator' },
  active: false,
};

/** A home-built generic TC4 on a port, active, with the firmware's default wiring. */
export const POPPER: Roaster = {
  ...SKYWALKER,
  id: 3,
  name: 'Popper',
  model: 'tc4',
  connection: { kind: 'serial', path: '/dev/cu.usbserial-0001' },
  coolerHelpsDrum: false,
  wiring: DEFAULT_TC4_WIRING,
};

/** The two records, with this target picked: the roaster of its kind active and holding it. */
export function roastersWith(target: ConnectTarget | null): Roaster[] {
  if (target?.kind === 'simulator') {
    return [
      { ...SKYWALKER, active: false },
      { ...SIMULATOR, active: true },
    ];
  }
  return [{ ...SKYWALKER, connection: target }, SIMULATOR];
}
