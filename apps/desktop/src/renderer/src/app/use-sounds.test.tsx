import {
  AUTO_OFF,
  DEFAULT_SETTINGS,
  DEFAULT_SOUNDS,
  READY_ROAST,
  type AutoStatus,
  type RoastState,
  type RoastSummary,
  type Sounds,
} from '@roastpilot/shared';
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addReading, setRoast } from '../stores/roast-store';
import { fakeApi, renderApp } from '../test/render-app';
import { useSounds } from './use-sounds';

function SoundsHook() {
  useSounds();
  return null;
}

const PREHEAT: RoastState = { ...READY_ROAST, phase: 'preheat', preheatAtMs: 0 };
const ROASTING: RoastState = { ...PREHEAT, phase: 'roasting', chargedAtMs: 1_000 };
const AUTO: AutoStatus = { ...AUTO_OFF, enabled: true };

const saved = (id: number, fcTemp: number | null): RoastSummary => ({
  id,
  startedAt: `2026-11-0${String(id)}T09:00:00.000Z`,
  endedAt: null,
  fcTimeS: null,
  fcTemp,
  dropTimeS: null,
  dropTemp: null,
  roasterId: null,
  beanId: null,
  ghostRoastId: null,
  batchG: null,
  roastedG: null,
  rating: null,
  isFavourite: false,
  notes: null,
  profileId: null,
  profileName: null,
  imported: false,
});

function setup(history: RoastSummary[] = [], sounds: Sounds = DEFAULT_SOUNDS) {
  const api = fakeApi({ listRoasts: () => Promise.resolve(history) });
  const view = renderApp(<SoundsHook />, { settings: { ...DEFAULT_SETTINGS, sounds } }, api);
  const { stores } = view;
  return {
    ...view,
    roast: (roast: RoastState) => {
      act(() => {
        stores.roast.setState((data) => setRoast(data, roast));
      });
    },
    auto: (status: Partial<AutoStatus>) => {
      act(() => {
        stores.auto.setState({ status: { ...AUTO, ...status } });
      });
    },
    sounds: (next: Sounds) => {
      stores.settings.setState(({ settings }) => ({ settings: { ...settings, sounds: next } }));
    },
    reading: (atMs: number, bt: number) => {
      act(() => {
        stores.roast.setState((data) => addReading(data, { atMs, values: { bt } }));
      });
    },
  };
}

/** What played, as "voice volume", in order. */
const played = (chime: { play: { mock: { calls: [string, number][] } } }) =>
  chime.play.mock.calls.map(([voice, volumePct]) => `${voice} ${String(volumePct)}`);

const CHARGE_SOON = 'chime 80';
const DUMP_BEANS = 'chime 80';
const LISTEN = 'ping 70';
const AUTO_STOPPED = 'alert 90';

/** Lets the saved-roast list arrive in the hook. */
const listed = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

describe('useSounds', () => {
  it('plays Charge soon once when Auto says add beans, then Beans in once', () => {
    const s = setup();
    s.roast(PREHEAT);
    s.auto({ preheatStep: 'hold' });
    s.auto({ preheatStep: 'add-beans' });
    s.reading(1, 180);
    s.auto({ preheatStep: 'add-beans', preheatLeftS: 10 });
    s.auto({ preheatStep: 'beans-in' });
    s.reading(2, 181);
    expect(played(s.chime)).toEqual([CHARGE_SOON, 'chime 80']);
  });

  it('plays Dump beans once when the beans start cooling, not on every reading after', () => {
    const s = setup();
    s.roast({ ...ROASTING, phase: 'development', firstCrackAtMs: 2_000 });
    s.roast({ ...ROASTING, phase: 'cooling', firstCrackAtMs: 2_000, droppedAtMs: 3_000 });
    s.reading(4_000, 190);
    s.reading(5_000, 180);
    expect(played(s.chime)).toEqual([DUMP_BEANS]);
  });

  it('plays Auto stopped once when Auto stops mid-roast, not for a safety stop', () => {
    const s = setup();
    s.roast(ROASTING);
    s.auto({});
    s.auto({ stopReason: 'disconnected' });
    s.reading(2_000, 150);
    expect(played(s.chime)).toEqual([AUTO_STOPPED]);
    s.auto({});
    s.auto({ stopReason: 'safety-stop' });
    expect(played(s.chime)).toEqual([AUTO_STOPPED]);
  });

  it('plays nothing with Sounds off', () => {
    const s = setup([], { ...DEFAULT_SOUNDS, enabled: false });
    s.roast(PREHEAT);
    s.auto({ preheatStep: 'add-beans' });
    s.roast({ ...ROASTING, phase: 'cooling', droppedAtMs: 3_000 });
    expect(s.chime.play).not.toHaveBeenCalled();
  });

  it('cues listen once per roast, 3 °C under the expected first crack', async () => {
    // Median of the last five with a crack: 196, so the cue is at 193 °C.
    const history = [
      saved(7, 200),
      saved(6, 195),
      saved(5, null),
      saved(4, 198),
      saved(3, 194),
      saved(2, 196),
      saved(1, 150),
    ];
    const s = setup(history);
    await listed();
    s.roast(ROASTING);
    s.reading(2_000, 192.9);
    expect(s.chime.play).not.toHaveBeenCalled();
    s.reading(3_000, 193);
    expect(played(s.chime)).toEqual([LISTEN]);
    s.reading(4_000, 195);
    expect(played(s.chime)).toEqual([LISTEN]);
    // The next roast hears it again.
    s.roast({ ...ROASTING, phase: 'cooling', droppedAtMs: 5_000 });
    s.roast({ ...ROASTING, chargedAtMs: 9_000 });
    s.reading(10_000, 194);
    expect(played(s.chime)).toEqual([LISTEN, DUMP_BEANS, LISTEN]);
  });

  it('no listen cue after the first-crack tap, or without a saved first crack', async () => {
    const s = setup([saved(1, null)]);
    await listed();
    s.roast(ROASTING);
    s.reading(2_000, 230);
    expect(s.chime.play).not.toHaveBeenCalled();

    const t = setup([saved(1, 196)]);
    await listed();
    t.roast({ ...ROASTING, phase: 'development', firstCrackAtMs: 1_500 });
    t.reading(2_000, 199);
    expect(t.chime.play).not.toHaveBeenCalled();
  });

  it("plays each step's own voice at its own volume", () => {
    const s = setup([], {
      enabled: true,
      steps: {
        ...DEFAULT_SOUNDS.steps,
        'charge-soon': { voice: 'bell', volumePct: 45, repeat: 'once' },
        'beans-in': { voice: 'beep', volumePct: 100, repeat: 'once' },
      },
    });
    s.roast(PREHEAT);
    s.auto({ preheatStep: 'add-beans' });
    s.auto({ preheatStep: 'beans-in' });
    expect(played(s.chime)).toEqual(['bell 45', 'beep 100']);
  });

  it("stays quiet while main's snapshot loads", () => {
    const s = setup();
    act(() => {
      s.stores.sync.setState({ ready: false });
    });
    s.roast({ ...ROASTING, phase: 'cooling', droppedAtMs: 3_000 });
    act(() => {
      s.stores.sync.setState({ ready: true });
    });
    s.reading(4_000, 180);
    expect(s.chime.play).not.toHaveBeenCalled();
  });
});

describe('useSounds repeats', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Moves the fake clock on, inside act. */
  const wait = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };
  /** When each play happened, in ms from `from`. */
  const timesOf = (plays: number[], from: number) => plays.map((at) => at - from);

  function timed(sounds: Sounds = DEFAULT_SOUNDS) {
    vi.useFakeTimers();
    const s = setup([], sounds);
    const plays: number[] = [];
    s.chime.play.mockImplementation(() => {
      plays.push(Date.now());
    });
    return { ...s, plays, startMs: Date.now() };
  }

  it('Charge soon repeats every 10 s while Auto waits for the beans, at most a minute', () => {
    const s = timed();
    s.roast(PREHEAT);
    s.auto({ preheatStep: 'add-beans' });
    wait(5 * 60_000);
    expect(timesOf(s.plays, s.startMs)).toEqual([
      0, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000,
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Charge soon stops at once when Auto moves on, and Beans in takes over', () => {
    const s = timed();
    s.roast(PREHEAT);
    s.auto({ preheatStep: 'add-beans' });
    wait(15_000);
    s.auto({ preheatStep: 'beans-in' });
    wait(15_000);
    // Charge soon at 0 and 10 s; Beans in at 15 and 25 s.
    expect(timesOf(s.plays, s.startMs)).toEqual([0, 10_000, 15_000, 25_000]);
    s.auto({ preheatStep: null });
    s.roast(ROASTING);
    wait(60_000);
    expect(s.plays).toHaveLength(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Auto stopped plays three times, Dump beans twice, each a brief pause after the last', () => {
    const s = timed();
    s.roast(ROASTING);
    s.auto({});
    s.auto({ stopReason: 'disconnected' });
    wait(10_000);
    expect(played(s.chime)).toEqual([AUTO_STOPPED, AUTO_STOPPED, AUTO_STOPPED]);
    s.roast({ ...ROASTING, phase: 'cooling', droppedAtMs: 3_000 });
    wait(10_000);
    // Alert sounds 580 ms and Chime 500 ms, then a 300 ms pause.
    expect(timesOf(s.plays, s.startMs)).toEqual([0, 880, 1_760, 10_000, 10_800]);
  });

  it('a counted repeat stops early when its step stops waiting', () => {
    const s = timed();
    s.roast(ROASTING);
    s.auto({});
    s.auto({ stopReason: 'disconnected' });
    wait(880);
    // Resume auto clears the stop reason: the third play never comes.
    s.auto({});
    wait(10_000);
    expect(played(s.chime)).toEqual([AUTO_STOPPED, AUTO_STOPPED]);
  });

  it('switching Sounds off cancels what is still to come', () => {
    const s = timed();
    s.roast(PREHEAT);
    s.auto({ preheatStep: 'add-beans' });
    act(() => {
      s.sounds({ ...DEFAULT_SOUNDS, enabled: false });
    });
    wait(60_000);
    expect(s.plays).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("changing the step's setting cancels its repeats, not other steps'", () => {
    const s = timed();
    s.roast(ROASTING);
    s.auto({});
    s.auto({ stopReason: 'disconnected' });
    s.roast({ ...ROASTING, phase: 'cooling', droppedAtMs: 3_000 });
    act(() => {
      s.sounds({
        ...DEFAULT_SOUNDS,
        steps: {
          ...DEFAULT_SOUNDS.steps,
          'dump-beans': { ...DEFAULT_SOUNDS.steps['dump-beans'], volumePct: 50 },
        },
      });
    });
    wait(10_000);
    // Auto stopped plays on (3 times); Dump beans' second play is cancelled.
    expect(played(s.chime)).toEqual([AUTO_STOPPED, DUMP_BEANS, AUTO_STOPPED, AUTO_STOPPED]);
  });

  it('a step reached again restarts its repeats instead of overlapping them', () => {
    const s = timed();
    s.roast(ROASTING);
    s.auto({});
    s.auto({ stopReason: 'disconnected' });
    wait(500);
    s.auto({});
    s.auto({ stopReason: 'disconnected' });
    wait(60_000);
    expect(timesOf(s.plays, s.startMs)).toEqual([0, 500, 1_380, 2_260]);
  });

  it('unmounting leaves no timer behind', () => {
    const s = timed();
    s.roast(PREHEAT);
    s.auto({ preheatStep: 'add-beans' });
    s.unmount();
    wait(60_000);
    expect(s.plays).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
