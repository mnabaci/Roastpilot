import { err, ok, READY_ROAST, type LogEntry, type RoastAction } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock';
import { createLogger } from '../logging/logger';
import { DEFAULT_COOLING_MS, ManualRoast } from './manual-roast';
import { manualRoastHarness } from './manual-roast.harness';

const setup = manualRoastHarness;

describe('ManualRoast', () => {
  it('starts Ready with nothing recorded', () => {
    const { roast } = setup();
    expect(roast.state).toEqual(READY_ROAST);
  });

  it('adds what Auto did to the events, with the latest temperature', async () => {
    const { clock, roast, act, setBt } = setup();
    setBt(95);
    await act('start');
    clock.advance(60_000);
    roast.note('phase', 'Heat on');
    roast.note('dry-end');
    expect(roast.state.events.slice(1)).toEqual([
      { kind: 'phase', atMs: 60_000, bt: 95, detail: 'Heat on' },
      { kind: 'dry-end', atMs: 60_000, bt: 95 },
    ]);
  });

  it('Preheat turns the drum and filter fan on and starts a new roast', async () => {
    const { clock, roast, sent, signals, act } = setup();
    clock.advance(5_000);
    await act('preheat');
    expect(roast.state).toMatchObject({ phase: 'preheat', preheatAtMs: 5_000 });
    expect(sent).toEqual(['drum=1', 'filter=1']);
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
      'filter=1',
      'drum=1',
      'filter=1',
      'heater=0',
      'fan=100',
      'cooling=100',
      'drum=1',
      'filter=1',
    ]);
    expect(signals).toEqual(['new-roast', 'roast-started@180000', 'roast-ended']);
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
    expect(sent).toEqual(['drum=1', 'filter=1']);
  });

  it('End roast in Preheat turns everything off and goes back to Ready, the preheat still shown', async () => {
    const { clock, roast, sent, signals, act } = setup();
    clock.advance(5_000);
    await act('preheat');
    sent.length = 0;
    expect(await roast.act('end')).toEqual(ok(undefined));
    // Kept so the chart and Clear know a preheat is on screen; Clear forgets it.
    expect(roast.state).toMatchObject({ phase: 'ready', preheatAtMs: 5_000, events: [] });
    expect(sent).toEqual(['heater=0', 'fan=0', 'cooling=0', 'drum=0', 'filter=0']);
    expect(signals).toEqual(['new-roast']);
    await act('clear');
    expect(roast.state.preheatAtMs).toBeNull();
    await act('preheat');
    expect(roast.state.phase).toBe('preheat');
  });

  it('Clear forgets the last roast from Done or Ready, and sends nothing', async () => {
    const { clock, roast, sent, signals, act } = setup();
    await act('start', 'drop');
    await clock.runFor(DEFAULT_COOLING_MS);
    sent.length = 0;
    signals.length = 0;
    expect(await roast.act('clear')).toEqual(ok(undefined));
    expect(roast.state).toMatchObject({ phase: 'ready', events: [], chargedAtMs: null });
    expect(signals).toEqual(['new-roast']);
    expect(sent).toEqual([]);
  });

  it.each(['preheat', 'roasting', 'cooling'] as const)(
    'Clear is refused from %s',
    async (phase) => {
      const { roast, act } = setup();
      const path: Record<typeof phase, RoastAction[]> = {
        preheat: ['preheat'],
        roasting: ['start'],
        cooling: ['start', 'drop'],
      };
      await act(...path[phase]);
      expect(await roast.act('clear')).toEqual(
        err({ kind: 'not-allowed', action: 'clear', phase }),
      );
    },
  );

  it.each(['roasting', 'development'] as const)(
    'End roast from %s turns everything off, records the end and goes to Done',
    async (phase) => {
      const { clock, roast, sent, signals, act } = setup();
      await act(
        ...(phase === 'roasting' ? ['start' as const] : ['start' as const, 'first-crack' as const]),
      );
      sent.length = 0;
      clock.advance(60_000);
      expect(await roast.act('end')).toEqual(ok(undefined));
      expect(roast.state.phase).toBe('done');
      expect(roast.state.events.at(-1)).toEqual({ kind: 'end', atMs: 60_000, bt: 25 });
      expect(sent).toEqual(['heater=0', 'fan=0', 'cooling=0', 'drum=0', 'filter=0']);
      // Max roast time is disarmed, as at Drop.
      expect(signals).toEqual(['roast-started@0', 'roast-ended']);
      await act('preheat');
      expect(roast.state.phase).toBe('preheat');
    },
  );

  it('Finish cooling now ends cooling at once, and the old timer does nothing later', async () => {
    const { clock, roast, sent, act } = setup();
    await act('start', 'drop');
    sent.length = 0;
    clock.advance(30_000);
    await act('end');
    expect(roast.state.phase).toBe('done');
    expect(roast.state.events.at(-1)).toMatchObject({ kind: 'cool-end', atMs: 30_000 });
    expect(sent).toEqual(['heater=0', 'fan=0', 'cooling=0', 'drum=0', 'filter=0']);
    await act('preheat');
    sent.length = 0;
    await clock.runFor(DEFAULT_COOLING_MS);
    expect(roast.state.phase).toBe('preheat');
    expect(sent).toEqual([]);
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
    [[], 'end'],
    [['start', 'drop'], 'clear'],
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

  it.each<[string, RoastAction[], string[]]>([
    ['Preheat', ['preheat'], ['drum=1', 'filter=1']],
    ['Roasting', ['start'], ['drum=1', 'filter=1']],
    ['Development', ['start', 'first-crack'], ['drum=1', 'filter=1']],
    ['Cooling', ['start', 'drop'], ['heater=0', 'fan=100', 'cooling=100', 'drum=1', 'filter=1']],
  ])(
    'after a reconnect in %s, puts the phase outputs back, never heat',
    async (_, actions, want) => {
      const { roast, sent, entries, act } = setup();
      await act(...actions);
      sent.length = 0;
      await roast.restoreOutputs();
      expect(sent).toEqual(want);
      expect(entries.find((e) => e.event === 'roast.outputs-restored')?.context).toEqual({
        phase: roast.state.phase,
      });
    },
  );

  it('after a reconnect in Ready or Done, sends nothing', async () => {
    const { roast, sent, entries, act } = setup();
    await roast.restoreOutputs();
    await act('preheat', 'end');
    sent.length = 0;
    await roast.restoreOutputs();
    await act('start', 'end');
    expect(roast.state.phase).toBe('done');
    sent.length = 0;
    await roast.restoreOutputs();
    expect(sent).toEqual([]);
    expect(entries.some((e) => e.event === 'roast.outputs-restored')).toBe(false);
  });

  it('a failed restore is logged per output and never throws', async () => {
    const { roast, entries, act } = setup({ failOutputs: true });
    await act('preheat');
    entries.length = 0;
    await roast.restoreOutputs();
    expect(entries.filter((e) => e.event === 'roast.output-failed')).toHaveLength(2);
  });

  it('still moves on and sends every output when some fail, and logs each failure', async () => {
    const { roast, sent, entries, act } = setup({ failOutputs: true });
    await act('start', 'drop');
    expect(roast.state.phase).toBe('cooling');
    expect(sent).toEqual([
      'drum=1',
      'filter=1',
      'heater=0',
      'fan=100',
      'cooling=100',
      'drum=1',
      'filter=1',
    ]);
    expect(entries.filter((e) => e.event === 'roast.output-failed')).toHaveLength(7);
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
