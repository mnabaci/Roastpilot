import {
  err,
  ok,
  PROFILE_SCHEMA_VERSION,
  READY_ROAST,
  type AutoProfile,
  type AutoTuning,
  type DriverError,
  type Reading,
  type Result,
  type RoastState,
} from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { AutoPilot } from './auto-pilot';
import type { AutoEvent } from './roast-run';

const PROFILE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'light-steps',
  name: 'Light · Steps',
  needsCalibration: true,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 90,
  capC: 200,
  curve: [
    { tS: 0, c: 180 },
    { tS: 60, c: 92 },
    { tS: 600, c: 190 },
  ],
  phases: [
    { name: 'Soak', heat: { mode: 'fixed', pct: 0 }, fanPct: 30, next: { on: 'time', afterS: 60 } },
    {
      name: 'Heat on',
      heat: { mode: 'target', pct: 85, endC: 150, durationS: 245, rorMin: 14, rorMax: 18 },
      fanPct: 30,
      next: { on: 'bt', c: 150, backupS: 390 },
    },
    {
      name: 'Finish',
      heat: { mode: 'target', pct: 40, endC: 191, durationS: 94, rorMin: 3, rorMax: 7 },
      fanPct: 80,
      next: { on: 'end' },
    },
  ],
};
const TUNING: AutoTuning = {
  target: { kp: 1, ki: 0, kd: 0 },
  targetLimitPct: 20,
  follow: { kp: 1, ki: 0, kd: 0 },
  preheat: { kp: 2, ki: 0, kd: 0 },
  preheatFanPct: 30,
  holdS: 150,
  chargeCutS: 5,
};

const reading = (atMs: number, bt?: number): Reading => ({
  atMs,
  values: bt === undefined ? {} : { bt },
});

function fakeLogger() {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

function setup(initial: Partial<RoastState> = {}) {
  const logger = fakeLogger();
  let state: RoastState = { ...READY_ROAST, ...initial };
  let locked = false;
  const readings: Reading[] = [];
  const events: AutoEvent[] = [];
  const setOutput = vi.fn((_channel: string, _value: number): Promise<Result<void, DriverError>> =>
    Promise.resolve(ok(undefined)),
  );
  const drop = vi.fn(() => {
    state = { ...state, phase: 'cooling' };
    return Promise.resolve();
  });
  const onChange = vi.fn();
  const pilot = new AutoPilot({
    roast: () => state,
    readings: () => readings,
    setOutput,
    round: (_channel, value) => Math.round(value / 5) * 5,
    heaterLocked: () => locked,
    drop,
    profile: () => PROFILE,
    tuning: () => TUNING,
    soakS: () => 60,
    onEvent: (event) => events.push(event),
    onChange,
    logger,
  });
  const feed = async (atMs: number, bt?: number) => {
    const next = reading(atMs, bt);
    readings.push(next);
    await pilot.onReading(next);
  };
  return {
    pilot,
    feed,
    setOutput,
    drop,
    events,
    onChange,
    logger,
    setState: (patch: Partial<RoastState>) => {
      state = { ...state, ...patch };
    },
    lock: (value: boolean) => {
      locked = value;
    },
    sent: () => setOutput.mock.calls.map(([channel, value]) => [channel, value]),
  };
}

const ROASTING = { phase: 'roasting', chargedAtMs: 0 } as const;

describe('AutoPilot', () => {
  it('sends nothing while off', async () => {
    const { feed, setOutput } = setup({ phase: 'preheat' });
    await feed(0, 100);
    expect(setOutput).not.toHaveBeenCalled();
  });

  it('tells the window once when asked to stay as it is', () => {
    const { pilot, onChange } = setup(ROASTING);
    pilot.setEnabled(true);
    const before = onChange.mock.calls.length;
    pilot.setEnabled(true);
    expect(onChange.mock.calls.length).toBe(before);
  });

  it('still drops the next roast after going Manual right after a drop', async () => {
    const { pilot, feed, setState, drop } = setup(ROASTING);
    pilot.setEnabled(true);
    await feed(1_000, PROFILE.capC + 1);
    expect(drop).toHaveBeenCalledOnce();
    pilot.setEnabled(false);
    await feed(2_000, 100);
    pilot.setEnabled(true);
    setState({ phase: 'roasting', chargedAtMs: 5_000 });
    await feed(6_000, PROFILE.capC + 1);
    expect(drop).toHaveBeenCalledTimes(2);
  });

  it('cuts the heater and stops when Drop fails, rather than driving on', async () => {
    const { pilot, feed, setOutput, drop } = setup(ROASTING);
    pilot.setEnabled(true);
    drop.mockRejectedValueOnce(new Error('refused'));
    await feed(1_000, PROFILE.capC + 1);
    expect(setOutput).toHaveBeenLastCalledWith('heater', 0);
    expect(pilot.status).toMatchObject({ heater: 'manual', fan: 'manual' });
    expect(pilot.status.stopReason).not.toBeNull();
  });

  it('drops again after a refused Drop and Resume auto, rather than heating past the end', async () => {
    const { pilot, feed, setOutput, drop } = setup(ROASTING);
    pilot.setEnabled(true);
    drop.mockRejectedValueOnce(new Error('refused'));
    await feed(1_000, PROFILE.capC + 1);
    expect(pilot.resume()).toEqual(ok(undefined));
    setOutput.mockClear();
    await feed(2_000, PROFILE.capC + 1);
    expect(drop).toHaveBeenCalledTimes(2);
    expect(setOutput.mock.calls.filter(([c, v]) => c === 'heater' && v > 0)).toEqual([]);
  });

  it('leaves a heater you took alone when it fails', async () => {
    const { pilot, feed, setOutput, drop } = setup(ROASTING);
    pilot.setEnabled(true);
    await feed(1_000, 170);
    pilot.outputRequested('heater', 50);
    setOutput.mockClear();
    drop.mockRejectedValueOnce(new Error('refused'));
    await feed(2_000, PROFILE.capC + 1);
    await feed(3_000, PROFILE.capC + 1);
    expect(setOutput).not.toHaveBeenCalledWith('heater', 0);
    expect(pilot.status.stopReason).not.toBeNull();
  });

  it('still stops when even the heater cut fails', async () => {
    const { pilot, feed, setOutput, drop } = setup(ROASTING);
    pilot.setEnabled(true);
    await feed(1_000, 170);
    drop.mockRejectedValueOnce(new Error('refused'));
    await feed(2_000, PROFILE.capC + 1);
    setOutput.mockRejectedValueOnce(new Error('port gone'));
    await feed(3_000, PROFILE.capC + 1);
    expect(pilot.status.stopReason).not.toBeNull();
  });

  it('records nothing for a manual roast', async () => {
    const { feed, events } = setup(ROASTING);
    await feed(1_000, 170);
    expect(events).toEqual([]);
  });

  it('sends nothing in Ready, Cooling or Done', async () => {
    for (const phase of ['ready', 'cooling', 'done'] as const) {
      const { pilot, feed, setOutput } = setup({ phase });
      pilot.setEnabled(true);
      await feed(0, 100);
      expect(setOutput).not.toHaveBeenCalled();
    }
  });

  describe('preheat', () => {
    it('runs the protocol: climbs from cold', async () => {
      const { pilot, feed, sent } = setup({ phase: 'preheat' });
      pilot.setEnabled(true);
      await feed(0, 100);
      await feed(1_000, 100);
      expect(pilot.status.preheatStep).toBe('climb');
      expect(sent()).toContainEqual(['fan', 30]);
      expect(sent()).toContainEqual(['heater', 100]);
    });

    it('Charge soon needs "Add beans"', async () => {
      const { pilot, feed } = setup({ phase: 'preheat' });
      pilot.setEnabled(true);
      await feed(0, 100);
      expect(pilot.chargeSoon(1_000)).toEqual(err({ kind: 'not-now' }));
    });

    it('stops when a preheat limit runs out, with the heater at 0', async () => {
      const { pilot, feed, setOutput } = setup({ phase: 'preheat' });
      pilot.setEnabled(true);
      await feed(0, 100);
      await feed(15 * 60_000, 100);
      expect(setOutput).toHaveBeenLastCalledWith('heater', 0);
      expect(setOutput.mock.calls.filter(([c]) => c === 'fan').at(-1)?.[1]).toBe(30);
      expect(pilot.status.stopReason).toBe('preheat-limit');
      expect(pilot.status.stopReason).not.toBeNull();
      setOutput.mockClear();
      await feed(15 * 60_000 + 1_000, 100);
      expect(setOutput).not.toHaveBeenCalled();
    });
  });

  describe('roast', () => {
    it('soaks at heater 0, then starts the next phase on time', async () => {
      const { pilot, feed, sent, events } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      expect(sent()).toEqual([
        ['heater', 0],
        ['fan', 30],
      ]);
      expect(pilot.status.phaseName).toBe('Soak');
      await feed(60_000, 92);
      expect(pilot.status.phaseName).toBe('Heat on');
      expect(pilot.status.nextPhaseAtC).toBe(150);
      expect(sent()).toContainEqual(['heater', 85]);
      expect(events).toEqual([
        // Turned on with the roast already charged.
        { kind: 'mode', auto: true },
        { kind: 'phase', name: 'Soak' },
        { kind: 'phase', name: 'Heat on' },
      ]);
    });

    it('sends only changes', async () => {
      const { pilot, feed, setOutput } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      await feed(2_000, 165);
      await feed(3_000, 160);
      expect(setOutput).toHaveBeenCalledTimes(2);
    });

    it('tries a failed command again on the next reading', async () => {
      const { pilot, feed, setOutput } = setup(ROASTING);
      setOutput.mockResolvedValueOnce(err({ kind: 'disconnected' }));
      pilot.setEnabled(true);
      await feed(1_000, 170);
      await feed(2_000, 165);
      expect(setOutput.mock.calls.filter(([c]) => c === 'heater')).toHaveLength(2);
    });

    it('drops once at the BT cap and sends nothing more', async () => {
      const { pilot, feed, drop, setOutput } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 200);
      expect(drop).toHaveBeenCalledTimes(1);
      setOutput.mockClear();
      await feed(2_000, 200);
      expect(drop).toHaveBeenCalledTimes(1);
      expect(setOutput).not.toHaveBeenCalled();
    });

    it('drops at the development time after your first-crack tap', async () => {
      const { pilot, feed, drop } = setup({
        phase: 'development',
        chargedAtMs: 0,
        firstCrackAtMs: 500_000,
      });
      pilot.setEnabled(true);
      await feed(589_000, 190);
      expect(drop).not.toHaveBeenCalled();
      await feed(590_000, 190);
      expect(drop).toHaveBeenCalledTimes(1);
    });

    it('starts over for a new roast', async () => {
      const { pilot, feed, setState } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(120_000, 100);
      setState({ chargedAtMs: 200_000 });
      await feed(201_000, 170);
      expect(pilot.status.phaseName).toBe('Soak');
    });
  });

  describe('you and Auto', () => {
    it('leaves an output you touched, and keeps driving the other', async () => {
      const { pilot, feed, setOutput, events } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      pilot.outputRequested('heater', 50);
      expect(pilot.status).toMatchObject({ heater: 'manual', fan: 'auto' });
      expect(events).toContainEqual({ kind: 'override', channel: 'heater', value: 50 });
      setOutput.mockClear();
      await feed(70_000, 92);
      expect(setOutput.mock.calls.some(([c]) => c === 'heater')).toBe(false);
    });

    it('ignores drum, filter and cooling', async () => {
      const { pilot, feed } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      pilot.outputRequested('drum', 0);
      expect(pilot.status).toMatchObject({ heater: 'auto', fan: 'auto' });
    });

    it('takes no override while off or outside a roast', () => {
      const { pilot } = setup({ phase: 'done' });
      pilot.outputRequested('heater', 0);
      pilot.setEnabled(true);
      pilot.outputRequested('heater', 0);
      expect(pilot.status.heater).toBe('auto');
    });

    it('Resume auto hands it back and sends the current value again', async () => {
      const { pilot, feed, setOutput } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      pilot.outputRequested('heater', 50);
      expect(pilot.resume()).toEqual(ok(undefined));
      setOutput.mockClear();
      await feed(2_000, 170);
      expect(setOutput).toHaveBeenCalledWith('heater', 0);
    });

    it('switching to Manual stops all commands', async () => {
      const { pilot, feed, setOutput } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      pilot.setEnabled(false);
      setOutput.mockClear();
      await feed(70_000, 92);
      expect(setOutput).not.toHaveBeenCalled();
    });

    it('picks up mid-roast at the phase the roast has reached', async () => {
      const { pilot, feed } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(120_000, 110);
      expect(pilot.status.phaseName).toBe('Heat on');
    });
  });

  describe('stops', () => {
    it('hands both outputs to you and sends nothing more', async () => {
      const { pilot, feed, setOutput } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      pilot.stop('safety-stop');
      expect(pilot.status).toMatchObject({ heater: 'manual', fan: 'manual' });
      expect(pilot.status.stopReason).not.toBeNull();
      setOutput.mockClear();
      await feed(70_000, 92);
      expect(setOutput).not.toHaveBeenCalled();
    });

    it('does not drop by itself after a stop', async () => {
      const { pilot, feed, drop } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      pilot.stop('lost');
      await feed(2_000, 205);
      expect(drop).not.toHaveBeenCalled();
    });

    it('stops by itself when it finds the heater locked', async () => {
      const { pilot, feed, setOutput, lock } = setup(ROASTING);
      pilot.setEnabled(true);
      lock(true);
      await feed(1_000, 170);
      expect(pilot.status.stopReason).not.toBeNull();
      expect(setOutput).not.toHaveBeenCalled();
    });

    it('stays stopped when readings come back: never turns the heater on by itself', async () => {
      const { pilot, feed, setOutput } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(70_000, 92);
      pilot.stop('lost');
      setOutput.mockClear();
      await feed(80_000, 95);
      await feed(90_000, 96);
      expect(setOutput).not.toHaveBeenCalled();
      expect(pilot.status.stopReason).not.toBeNull();
    });

    it('does not carry a stop or an override into the next roast', async () => {
      const { pilot, feed, setState, setOutput } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      pilot.stop('safety-stop');
      setState({ phase: 'done' });
      await feed(2_000, 100);
      expect(pilot.status).toMatchObject({ stopReason: null, heater: 'auto', fan: 'auto' });
      setState({ phase: 'preheat' });
      setOutput.mockClear();
      await feed(3_000, 100);
      expect(setOutput).toHaveBeenCalledWith('heater', expect.any(Number));
    });

    it('refuses Resume auto while the heater is locked', async () => {
      const { pilot, feed, lock } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      pilot.stop('safety-stop');
      lock(true);
      expect(pilot.resume()).toEqual(err({ kind: 'safety-locked' }));
      expect(pilot.status.stopReason).not.toBeNull();
    });

    it('Resume auto carries on after you acknowledge', async () => {
      const { pilot, feed, setOutput } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      pilot.stop('safety-stop');
      expect(pilot.resume()).toEqual(ok(undefined));
      setOutput.mockClear();
      await feed(70_000, 92);
      expect(setOutput).toHaveBeenCalledWith('heater', 85);
    });

    it('a crash in a tick stops Auto and is logged, not thrown', async () => {
      const { pilot, feed, setState } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(1_000, 170);
      setState({ events: null as unknown as RoastState['events'] });
      await expect(feed(2_000, 170)).resolves.toBeUndefined();
    });
  });

  describe('readings that lie', () => {
    it('ignores one bad reading at the BT cap; two in a row drop', async () => {
      const { pilot, feed, drop } = setup(ROASTING);
      pilot.setEnabled(true);
      await feed(400_000, 185);
      await feed(401_000, 185);
      await feed(402_000, PROFILE.capC + 30);
      await feed(403_000, 186);
      expect(drop).not.toHaveBeenCalled();
      await feed(404_000, PROFILE.capC);
      await feed(405_000, PROFILE.capC);
      expect(drop).toHaveBeenCalledTimes(1);
    });

    it('logs once when a command holds up every later reading', async () => {
      const { pilot, setOutput, logger } = setup(ROASTING);
      pilot.setEnabled(true);
      setOutput.mockImplementationOnce(() => new Promise(() => undefined));
      void pilot.onReading(reading(1_000, 170));
      for (let atMs = 2_000; atMs <= 9_000; atMs += 1_000)
        await pilot.onReading(reading(atMs, 170));
      expect(logger.error.mock.calls.filter(([name]) => name === 'auto.tick-stuck')).toHaveLength(
        1,
      );
    });
  });

  describe('the heater cut has to land', () => {
    it('Charge soon sends heater 0 at once, not on the next reading', async () => {
      const { pilot, feed, setOutput } = setup({ phase: 'preheat' });
      pilot.setEnabled(true);
      await feed(0, 100);
      await feed(1_000, 180);
      await feed(151_000, 180);
      expect(pilot.status.preheatStep).toBe('add-beans');
      setOutput.mockClear();
      expect(pilot.chargeSoon(150_500)).toEqual(ok(undefined));
      expect(setOutput).toHaveBeenCalledWith('heater', 0);
    });

    it('sends heater 0 again on every reading after Drop until it lands', async () => {
      const { pilot, feed, setOutput } = setup(ROASTING);
      pilot.setEnabled(true);
      setOutput.mockResolvedValueOnce(err({ kind: 'disconnected' }));
      await feed(1_000, PROFILE.capC);
      await feed(2_000, 150);
      await feed(3_000, 140);
      expect(setOutput.mock.calls).toEqual([
        ['heater', 0],
        ['heater', 0],
      ]);
    });

    it('gives way to the next preheat, so an old cut never lands over its heat', async () => {
      const { pilot, feed, setOutput, setState, sent } = setup(ROASTING);
      pilot.setEnabled(true);
      setOutput.mockResolvedValueOnce(err({ kind: 'disconnected' }));
      await feed(1_000, PROFILE.capC);
      setState({ phase: 'preheat', chargedAtMs: null });
      setOutput.mockClear();
      await feed(2_000, 100);
      await feed(3_000, 100);
      // The preheat's own first step, then its climb: no old 0 in between.
      expect(sent().filter(([c]) => c === 'heater')).toEqual([
        ['heater', 0],
        ['heater', 100],
      ]);
    });

    it('stops sending it once you set the heater yourself', async () => {
      const { pilot, feed, setOutput } = setup(ROASTING);
      pilot.setEnabled(true);
      setOutput.mockResolvedValueOnce(err({ kind: 'disconnected' }));
      await feed(1_000, PROFILE.capC);
      pilot.outputRequested('heater', 40);
      setOutput.mockClear();
      await feed(3_000, 150);
      expect(setOutput).not.toHaveBeenCalled();
    });
  });

  describe('turned on mid-roast', () => {
    it('starts at the phase the roast has reached, without replaying the soak', async () => {
      const { pilot, feed, sent, events } = setup(ROASTING);
      for (let s = 1; s <= 120; s++) await feed(s * 1_000, s < 60 ? 170 : 100 + s / 2);
      pilot.setEnabled(true);
      await feed(121_000, 161);
      expect(pilot.status.phaseName).toBe('Finish');
      // One command, Finish's own: its 40% less the −20% limit, as RoR runs at 30 °C/min.
      expect(sent().filter(([c]) => c === 'heater')).toEqual([['heater', 20]]);
      expect(events).toEqual([
        { kind: 'mode', auto: true },
        { kind: 'phase', name: 'Finish' },
      ]);
    });

    it('says when it is turned off mid-roast, but not outside one', () => {
      const roasting = setup(ROASTING);
      roasting.pilot.setEnabled(true);
      roasting.pilot.setEnabled(false);
      expect(roasting.events).toEqual([
        { kind: 'mode', auto: true },
        { kind: 'mode', auto: false },
      ]);
      const ready = setup();
      ready.pilot.setEnabled(true);
      expect(ready.events).toEqual([]);
    });
  });

  it('tells the window only when the status changes, and survives a bad listener', async () => {
    const { pilot, feed, onChange } = setup(ROASTING);
    onChange.mockImplementation(() => {
      throw new Error('window gone');
    });
    pilot.setEnabled(true);
    await feed(1_000, 170);
    const calls = onChange.mock.calls.length;
    await feed(2_000, 170);
    expect(onChange.mock.calls.length).toBe(calls);
  });
});
