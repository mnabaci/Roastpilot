import { err, ok, type LogEntry, type RoastAction, type RoastState } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock';
import { createLogger } from '../logging/logger';
import { DEFAULT_COOLING_MS, ManualRoast } from './manual-roast';

function setup(options: { failOutputs?: boolean } = {}) {
  const clock = new ManualClock();
  const sent: string[] = [];
  const signals: string[] = [];
  const states: RoastState[] = [];
  const entries: LogEntry[] = [];
  let bt: number | undefined = 25;
  const roast = new ManualRoast({
    clock,
    setOutput: (channel, value) => {
      sent.push(`${channel}=${String(value)}`);
      return Promise.resolve(options.failOutputs ? err({ kind: 'disconnected' }) : ok(undefined));
    },
    latestBt: () => bt,
    onChange: (s) => states.push(s),
    onNewRoast: () => signals.push('new-roast'),
    onRoastStarted: () => signals.push('roast-started'),
    onRoastEnded: () => signals.push('roast-ended'),
    logger: createLogger({ write: (e) => entries.push(e) }, 'roast'),
  });
  const act = (...actions: RoastAction[]) =>
    actions.reduce<Promise<unknown>>((p, a) => p.then(() => roast.act(a)), Promise.resolve());
  return {
    clock,
    roast,
    sent,
    signals,
    states,
    entries,
    act,
    setBt: (value: number | undefined) => {
      bt = value;
    },
  };
}

describe('ManualRoast', () => {
  it('starts Ready with nothing recorded', () => {
    const { roast } = setup();
    expect(roast.state).toEqual({
      phase: 'ready',
      chargedAtMs: null,
      firstCrackAtMs: null,
      droppedAtMs: null,
      coolingEndsAtMs: null,
      events: [],
    });
  });

  it('Preheat turns the drum and filter fan on and starts a new roast', async () => {
    const { roast, sent, signals, act } = setup();
    await act('preheat');
    expect(roast.state.phase).toBe('preheat');
    expect(sent).toEqual(['drum=1', 'filter=100']);
    expect(signals).toEqual(['new-roast']);
  });

  it('runs the whole flow with the right outputs, events and safety signals', async () => {
    const { clock, roast, sent, signals, act, setBt } = setup();
    await act('preheat');
    clock.advance(180_000);
    setBt(180);
    await act('start');
    clock.advance(480_000);
    setBt(196);
    await act('first-crack');
    clock.advance(70_000);
    setBt(204);
    await act('drop');

    expect(roast.state).toMatchObject({
      phase: 'cooling',
      chargedAtMs: 180_000,
      firstCrackAtMs: 660_000,
      droppedAtMs: 730_000,
      coolingEndsAtMs: 730_000 + DEFAULT_COOLING_MS,
    });
    expect(roast.state.events).toEqual([
      { kind: 'charge', atMs: 180_000, bt: 180 },
      { kind: 'first-crack', atMs: 660_000, bt: 196 },
      { kind: 'drop', atMs: 730_000, bt: 204 },
    ]);
    expect(sent).toEqual([
      'drum=1',
      'filter=100',
      'drum=1',
      'filter=100',
      'heater=0',
      'fan=100',
      'cooling=100',
    ]);
    expect(signals).toEqual(['new-roast', 'roast-started', 'roast-ended']);
  });

  it('turns everything off when cooling ends, then allows the next Preheat', async () => {
    const { clock, roast, sent, act } = setup();
    await act('preheat', 'start', 'drop');
    sent.length = 0;
    await clock.runFor(DEFAULT_COOLING_MS);
    expect(roast.state.phase).toBe('done');
    expect(roast.state.events.at(-1)?.kind).toBe('cool-end');
    expect(sent).toEqual(['heater=0', 'fan=0', 'cooling=0', 'drum=0', 'filter=0']);
    await act('preheat');
    expect(roast.state).toMatchObject({ phase: 'preheat', events: [], chargedAtMs: null });
  });

  it('lets Full control start without Preheat, drum and filter fan still on', async () => {
    const { roast, sent, act } = setup();
    await act('start');
    expect(roast.state.phase).toBe('roasting');
    expect(sent).toEqual(['drum=1', 'filter=100']);
  });

  it('can drop before first crack', async () => {
    const { roast, act } = setup();
    await act('start', 'drop');
    expect(roast.state).toMatchObject({ phase: 'cooling', firstCrackAtMs: null });
  });

  it.each<[RoastAction[], RoastAction]>([
    [[], 'first-crack'],
    [[], 'drop'],
    [['preheat'], 'preheat'],
    [['preheat'], 'first-crack'],
    [['start'], 'start'],
    [['start', 'first-crack'], 'first-crack'],
    [['start', 'drop'], 'drop'],
    [['start', 'drop'], 'start'],
    [['start', 'drop'], 'preheat'],
  ])('after %j refuses %s, changes nothing and logs it', async (before, action) => {
    const { roast, sent, states, entries, act } = setup();
    await act(...before);
    const state = roast.state;
    const [sentBefore, statesBefore] = [sent.length, states.length];
    expect(await roast.act(action)).toEqual(
      err({ kind: 'not-allowed', action, phase: state.phase }),
    );
    expect(roast.state).toBe(state);
    expect([sent.length, states.length]).toEqual([sentBefore, statesBefore]);
    expect(entries.at(-1)?.event).toBe('roast.action-not-allowed');
  });

  it('records a null temperature when there is no reading yet', async () => {
    const { roast, act, setBt } = setup();
    setBt(undefined);
    await act('start');
    expect(roast.state.events[0]?.bt).toBeNull();
  });

  it('still moves on and sends every output when some fail, and logs each failure', async () => {
    const { roast, sent, entries, act } = setup({ failOutputs: true });
    await act('start', 'drop');
    expect(roast.state.phase).toBe('cooling');
    expect(sent).toEqual(['drum=1', 'filter=100', 'heater=0', 'fan=100', 'cooling=100']);
    expect(entries.filter((e) => e.event === 'roast.output-failed')).toHaveLength(5);
  });

  it('a cooling timer from an earlier roast never ends a later one', async () => {
    const { clock, roast, act } = setup();
    await act('start', 'drop');
    await clock.runFor(DEFAULT_COOLING_MS);
    await act('preheat', 'start');
    clock.advance(1000);
    await act('drop');
    await clock.runFor(DEFAULT_COOLING_MS - 1000);
    expect(roast.state.phase).toBe('cooling');
    await clock.runFor(1000);
    expect(roast.state.phase).toBe('done');
  });

  it('publishes every change, and survives a listener that throws', async () => {
    const clock = new ManualClock();
    const entries: LogEntry[] = [];
    const roast = new ManualRoast({
      clock,
      setOutput: () => Promise.resolve(ok(undefined)),
      latestBt: () => 30,
      onChange: () => {
        throw new Error('window gone');
      },
      onNewRoast: () => undefined,
      onRoastStarted: () => undefined,
      onRoastEnded: () => undefined,
      logger: createLogger({ write: (e) => entries.push(e) }, 'roast'),
    });
    expect((await roast.act('preheat')).ok).toBe(true);
    expect(roast.state.phase).toBe('preheat');
    expect(entries.some((e) => e.event === 'roast.listener-failed')).toBe(true);
  });
});
