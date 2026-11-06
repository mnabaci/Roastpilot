import {
  err,
  ok,
  READY_ROAST,
  type AutoProfile,
  type LogEntry,
  type Reading,
  type Result,
  type RoastDetail,
  type RoastId,
  type RoastState,
  type SavedEvent,
  type SavedSample,
  type StorageError,
} from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../logging/logger';
import type { RoastRepository, RoastSummaryPatch } from './roast-repository';
import { RoastRecorder } from './roast-recorder';

const READY: RoastState = READY_ROAST;

type Saved<T> = Promise<Result<T, StorageError>>;

/** An in-memory repository; `failing` makes every write fail. */
class FakeRepository implements RoastRepository {
  readonly roasts = new Map<RoastId, RoastDetail>();
  failing = false;
  #next = 1;

  #fail(): Saved<never> {
    return Promise.resolve(err({ kind: 'storage-failed', message: 'disk full' }));
  }

  create(roast: Parameters<RoastRepository['create']>[0]): Saved<RoastId> {
    if (this.failing) return this.#fail();
    const id = this.#next++;
    this.roasts.set(id, {
      id,
      startedAt: roast.startedAt,
      mode: roast.mode,
      profile: roast.profile,
      roasterId: roast.roasterId,
      beanId: roast.beanId,
      ghostRoastId: roast.ghostRoastId,
      batchG: roast.batchG,
      roastedG: null,
      rating: null,
      isFavourite: false,
      notes: null,
      profileId: roast.profile?.id ?? null,
      profileName: roast.profile?.name ?? null,
      imported: roast.imported ?? false,
      endedAt: null,
      fcTimeS: null,
      dropTimeS: null,
      dropTemp: null,
      samples: [],
      events: [],
    });
    return Promise.resolve(ok(id));
  }
  saveResult(): Saved<void> {
    return Promise.resolve(ok(undefined));
  }
  addSamples(id: RoastId, samples: readonly SavedSample[]): Saved<void> {
    if (this.failing) return this.#fail();
    this.roasts.get(id)?.samples.push(...samples);
    return Promise.resolve(ok(undefined));
  }
  addEvent(id: RoastId, event: SavedEvent): Saved<void> {
    if (this.failing) return this.#fail();
    this.roasts.get(id)?.events.push(event);
    return Promise.resolve(ok(undefined));
  }
  update(id: RoastId, patch: RoastSummaryPatch): Saved<void> {
    if (this.failing) return this.#fail();
    const roast = this.roasts.get(id);
    if (roast) this.roasts.set(id, { ...roast, ...patch });
    return Promise.resolve(ok(undefined));
  }
  list(): Saved<RoastDetail[]> {
    return Promise.resolve(ok([...this.roasts.values()]));
  }
  get(id: RoastId): Saved<RoastDetail> {
    const roast = this.roasts.get(id);
    return Promise.resolve(roast ? ok(roast) : err({ kind: 'not-found', id }));
  }
  setBean(id: RoastId, beanId: number | null): Saved<void> {
    const roast = this.roasts.get(id);
    if (roast) this.roasts.set(id, { ...roast, beanId });
    return Promise.resolve(ok(undefined));
  }
  delete(id: RoastId): Saved<void> {
    this.roasts.delete(id);
    return Promise.resolve(ok(undefined));
  }
}

function setup(readingsSoFar: Reading[] = []) {
  const repository = new FakeRepository();
  const saved: RoastId[] = [];
  const entries: LogEntry[] = [];
  let now = '2026-11-04T10:00:00.000Z';
  const recorder = new RoastRecorder({
    repository,
    nowIso: () => now,
    readingsSoFar: () => readingsSoFar,
    onSaved: (id) => saved.push(id),
    logger: createLogger({ write: (e) => entries.push(e) }, 'history'),
  });
  return {
    repository,
    recorder,
    saved,
    entries,
    setNow: (iso: string) => {
      now = iso;
    },
  };
}

const reading = (atMs: number, bt: number): Reading => ({ atMs, values: { bt, heater: 50 } });

// A roast preheated at 0 s, charged at 120 s, first crack at 600 s, dropped at 700 s, cooled at 940 s.
const PREHEAT: RoastState = { ...READY, phase: 'preheat', preheatAtMs: 0 };
const CHARGED: RoastState = {
  ...PREHEAT,
  phase: 'roasting',
  chargedAtMs: 120_000,
  events: [{ kind: 'charge', atMs: 120_000, bt: 180 }],
};
const FIRST_CRACK: RoastState = {
  ...CHARGED,
  phase: 'development',
  firstCrackAtMs: 600_000,
  events: [...CHARGED.events, { kind: 'first-crack', atMs: 600_000, bt: 196 }],
};
const DROPPED: RoastState = {
  ...FIRST_CRACK,
  phase: 'cooling',
  droppedAtMs: 700_000,
  coolingEndsAtMs: 940_000,
  events: [...FIRST_CRACK.events, { kind: 'drop', atMs: 700_000, bt: 205.5 }],
};
const DONE: RoastState = {
  ...DROPPED,
  phase: 'done',
  coolingEndsAtMs: null,
  events: [...DROPPED.events, { kind: 'cool-end', atMs: 940_000, bt: 60 }],
};

describe('RoastRecorder', () => {
  it('saves nothing before charge, nor for a cancelled preheat', async () => {
    const { recorder, repository } = setup([reading(0, 25)]);
    recorder.onRoastChange(PREHEAT);
    recorder.onReading(reading(1_000, 30));
    recorder.onRoastChange(READY);
    await recorder.flush();
    expect(repository.roasts.size).toBe(0);
  });

  it('saves a whole roast: preheat readings at charge, then readings and events, ended at cool end', async () => {
    const { recorder, repository, saved, setNow } = setup([
      reading(0, 25),
      reading(60_000, 150),
      reading(120_000, 180),
    ]);
    recorder.onRoastChange(PREHEAT);
    recorder.onRoastChange(CHARGED);
    recorder.onReading(reading(121_000, 178));
    recorder.onRoastChange(FIRST_CRACK);
    recorder.onRoastChange(DROPPED);
    setNow('2026-11-04T10:15:40.000Z');
    recorder.onRoastChange(DONE);
    recorder.onReading(reading(941_000, 59));
    await recorder.flush();

    expect(repository.roasts.get(1)).toEqual({
      id: 1,
      mode: 'manual',
      profile: null,
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
      startedAt: '2026-11-04T10:00:00.000Z',
      endedAt: '2026-11-04T10:15:40.000Z',
      fcTimeS: 480,
      dropTimeS: 580,
      dropTemp: 205.5,
      samples: [
        { tS: -120, values: { bt: 25, heater: 50 } },
        { tS: -60, values: { bt: 150, heater: 50 } },
        { tS: 0, values: { bt: 180, heater: 50 } },
        { tS: 1, values: { bt: 178, heater: 50 } },
      ],
      events: [
        { kind: 'charge', tS: 0, bt: 180 },
        { kind: 'first-crack', tS: 480, bt: 196 },
        { kind: 'drop', tS: 580, bt: 205.5 },
        { kind: 'cool-end', tS: 820, bt: 60 },
      ],
    });
    // Saved once when created and once when finished, so History refreshes.
    expect(saved).toEqual([1, 1]);
  });

  it('saves the turning point, and moves the start back to a charge point found before the press', async () => {
    const { recorder, repository } = setup([reading(110_000, 186), reading(120_000, 175)]);
    // Charge found at 110 s; Start pressed at 117 s, when the wall clock said 10:00:00.
    const charged: RoastState = {
      ...PREHEAT,
      phase: 'roasting',
      chargedAtMs: 110_000,
      startPressedAtMs: 117_000,
      events: [{ kind: 'charge', atMs: 110_000, bt: 186 }],
    };
    recorder.onRoastChange(charged);
    recorder.onRoastChange({
      ...charged,
      events: [...charged.events, { kind: 'turning-point', atMs: 174_000, bt: 92.2 }],
    });
    await recorder.flush();
    expect(repository.roasts.get(1)).toMatchObject({
      startedAt: '2026-11-04T09:59:53.000Z',
      fcTimeS: null,
      samples: [
        { tS: 0, values: { bt: 186, heater: 50 } },
        { tS: 10, values: { bt: 175, heater: 50 } },
      ],
      events: [
        { kind: 'charge', tS: 0, bt: 186 },
        { kind: 'turning-point', tS: 64, bt: 92.2 },
      ],
    });
  });

  it('keeps the event detail, and the mode and profile copy the plan gives at charge', async () => {
    const repository = new FakeRepository();
    const profile = { name: 'copy' } as unknown as AutoProfile;
    const recorder = new RoastRecorder({
      repository,
      nowIso: () => '2026-11-04T10:00:00.000Z',
      readingsSoFar: () => [],
      onSaved: () => undefined,
      plan: () => ({
        mode: 'auto',
        profile,
        roasterId: 2,
        beanId: 3,
        batchG: 375,
        ghostRoastId: null,
      }),
    });
    recorder.onRoastChange(PREHEAT);
    recorder.onRoastChange(CHARGED);
    recorder.onRoastChange({
      ...CHARGED,
      events: [...CHARGED.events, { kind: 'phase', atMs: 180_000, bt: 90, detail: 'Heat on' }],
    });
    await recorder.flush();
    expect(repository.roasts.get(1)).toMatchObject({
      mode: 'auto',
      profile,
      roasterId: 2,
      beanId: 3,
      batchG: 375,
    });
    expect(repository.roasts.get(1)?.events.at(-1)).toEqual({
      kind: 'phase',
      tS: 60,
      bt: 90,
      detail: 'Heat on',
    });
  });

  it('a roast cut short stays unfinished', async () => {
    const { recorder, repository } = setup();
    recorder.onRoastChange(CHARGED);
    await recorder.flush();
    expect(repository.roasts.get(1)).toMatchObject({ endedAt: null, dropTimeS: null });
  });

  it('Full control without Preheat keeps only readings from charge on', async () => {
    const { recorder, repository } = setup([reading(0, 25), reading(120_000, 180)]);
    recorder.onRoastChange({ ...CHARGED, preheatAtMs: null });
    await recorder.flush();
    expect(repository.roasts.get(1)?.samples).toEqual([{ tS: 0, values: { bt: 180, heater: 50 } }]);
  });

  it('a roaster cool-down after Done is not a new roast', async () => {
    const { recorder, repository, saved } = setup();
    recorder.onRoastChange(CHARGED);
    recorder.onRoastChange(DONE);
    recorder.onRoastChange({ ...DONE, roasterCoolingSinceMs: 950_000, roasterCoolToC: 50 });
    recorder.onRoastChange({ ...DONE, roasterCoolingSinceMs: null, roasterCoolToC: null });
    recorder.onReading(reading(960_000, 49));
    await recorder.flush();
    expect([...repository.roasts.keys()]).toEqual([1]);
    expect(saved).toEqual([1, 1]);
  });

  it('a new charge after Done (Full control, no Preheat) still gets its own row', async () => {
    const { recorder, repository } = setup();
    recorder.onRoastChange(CHARGED);
    recorder.onRoastChange(DONE);
    recorder.onRoastChange({ ...CHARGED, chargedAtMs: 2_000_000 });
    await recorder.flush();
    expect([...repository.roasts.keys()]).toEqual([1, 2]);
  });

  it('the next roast gets its own row', async () => {
    const { recorder, repository } = setup();
    recorder.onRoastChange(CHARGED);
    recorder.onRoastChange(DONE);
    recorder.onRoastChange(READY);
    recorder.onRoastChange({ ...CHARGED, chargedAtMs: 2_000_000 });
    recorder.onReading(reading(2_001_000, 180));
    await recorder.flush();
    expect([...repository.roasts.keys()]).toEqual([1, 2]);
    expect(repository.roasts.get(2)?.samples).toEqual([{ tS: 1, values: { bt: 180, heater: 50 } }]);
  });

  it('a failed write is logged once, never throws, and later writes still go in', async () => {
    const { recorder, repository, entries } = setup();
    recorder.onRoastChange(CHARGED);
    await recorder.flush();
    repository.failing = true;
    recorder.onReading(reading(121_000, 178));
    recorder.onReading(reading(122_000, 179));
    await recorder.flush();
    repository.failing = false;
    recorder.onReading(reading(123_000, 180));
    await recorder.flush();
    expect(entries.filter((e) => e.event === 'history.write-failed')).toHaveLength(1);
    expect(entries.filter((e) => e.event === 'history.write-recovered')).toHaveLength(1);
    expect(repository.roasts.get(1)?.samples.map((s) => s.tS)).toEqual([3]);
  });

  it('when the roast row cannot be created, its writes are skipped and logged once', async () => {
    const { recorder, repository, entries, saved } = setup([reading(120_000, 180)]);
    repository.failing = true;
    recorder.onRoastChange(CHARGED);
    recorder.onReading(reading(121_000, 178));
    recorder.onRoastChange(DONE);
    await recorder.flush();
    expect(repository.roasts.size).toBe(0);
    expect(saved).toEqual([]);
    expect(entries.filter((e) => e.event === 'history.write-failed')).toHaveLength(1);
  });

  it('a repository that throws is logged, and the queue keeps going', async () => {
    const { recorder, repository, entries } = setup();
    recorder.onRoastChange(CHARGED);
    await recorder.flush();
    const addSamples = repository.addSamples.bind(repository);
    repository.addSamples = () => Promise.reject(new Error('bug'));
    recorder.onReading(reading(121_000, 178));
    await recorder.flush();
    repository.addSamples = addSamples;
    recorder.onReading(reading(122_000, 179));
    await recorder.flush();
    expect(entries.some((e) => e.event === 'history.write-threw')).toBe(true);
    expect(repository.roasts.get(1)?.samples.map((s) => s.tS)).toEqual([2]);
  });

  it('End roast finishes the saved roast where it stopped', async () => {
    const { recorder, repository, saved, setNow } = setup();
    recorder.onRoastChange(CHARGED);
    setNow('2026-11-04T10:05:00.000Z');
    recorder.onRoastChange({
      ...CHARGED,
      phase: 'done',
      events: [...CHARGED.events, { kind: 'end', atMs: 420_000, bt: 190 }],
    });
    recorder.onReading(reading(421_000, 189));
    await recorder.flush();
    expect(repository.roasts.get(1)).toMatchObject({
      endedAt: '2026-11-04T10:05:00.000Z',
      dropTimeS: null,
      events: [
        { kind: 'charge', tS: 0, bt: 180 },
        { kind: 'end', tS: 300, bt: 190 },
      ],
      samples: [],
    });
    expect(saved).toEqual([1, 1]);
  });

  it('knows which roast it is saving, until the roast is done', async () => {
    const { recorder } = setup();
    recorder.onRoastChange(CHARGED);
    await recorder.flush();
    expect(recorder.isRecording(1)).toBe(true);
    expect(recorder.isRecording(2)).toBe(false);
    recorder.onRoastChange(DONE);
    expect(recorder.isRecording(1)).toBe(false);
  });
});
