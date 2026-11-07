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
import { describe, expect, it } from 'vitest';
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
        'charge-soon': { voice: 'bell', volumePct: 45 },
        'beans-in': { voice: 'beep', volumePct: 100 },
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
