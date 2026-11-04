import type {
  Reading,
  Result,
  RoastEvent,
  RoastId,
  RoastState,
  SavedSample,
  StorageError,
} from '@roastpilot/shared';
import { FailureStreak } from '../logging/failure-streak';
import { serializeError } from '../logging/serialize-error';
import { silentLogger, type Logger } from '../logging/logger';
import type { RoastRepository, RoastSummaryPatch } from './roast-repository';

export interface RoastRecorderDeps {
  repository: RoastRepository;
  /** Wall-clock time as ISO 8601, for `startedAt` and `endedAt`. */
  nowIso: () => string;
  /** Readings kept since Preheat, saved at charge. */
  readingsSoFar: () => readonly Reading[];
  /** A roast was created or finished. */
  onSaved: (id: RoastId) => void;
  logger?: Logger;
}

/** The roast being saved: which charge it belongs to and how many events are written. */
interface Recording {
  chargedAtMs: number;
  id: Promise<RoastId | undefined>;
  /** The row's id once created. */
  savedId?: RoastId;
  eventsSaved: number;
}

const toSeconds = (ms: number) => Math.round(ms) / 1000;

/** What each event adds to the roast's summary row. */
const SUMMARY_FROM_EVENT: Readonly<
  Record<RoastEvent['kind'], (tS: number, event: RoastEvent, nowIso: string) => RoastSummaryPatch>
> = {
  charge: () => ({}),
  'first-crack': (tS) => ({ fcTimeS: tS }),
  drop: (tS, event) => ({ dropTimeS: tS, dropTemp: event.bt }),
  'cool-end': (_tS, _event, nowIso) => ({ endedAt: nowIso }),
  end: (_tS, _event, nowIso) => ({ endedAt: nowIso }),
};

/**
 * Saves every roast as it happens (docs/spec/data-model.md, Saving a roast): the row at charge with
 * the readings since Preheat, then each reading and event, and `endedAt` at cool end. Writes run
 * in order; a failed write is logged once per streak and never reaches the roast.
 */
export class RoastRecorder {
  readonly #deps: RoastRecorderDeps;
  readonly #logger: Logger;
  readonly #writes: FailureStreak;
  #recording: Recording | undefined;
  #queue: Promise<void> = Promise.resolve();

  constructor(deps: RoastRecorderDeps) {
    this.#deps = deps;
    this.#logger = deps.logger ?? silentLogger;
    this.#writes = new FailureStreak(this.#logger, 'history.write');
  }

  /** Every roast state ManualRoast publishes. */
  onRoastChange(state: RoastState): void {
    const { chargedAtMs } = state;
    if (chargedAtMs === null) {
      this.#recording = undefined;
      return;
    }
    if (this.#recording?.chargedAtMs !== chargedAtMs) this.#start(state, chargedAtMs);
    this.#saveNewEvents(state);
    if (state.phase === 'done') this.#recording = undefined;
  }

  /** Every reading from the roaster; saved while a roast is recording. */
  onReading(reading: Reading): void {
    const recording = this.#recording;
    if (recording)
      this.#write(recording, (id) =>
        this.#deps.repository.addSamples(id, [this.#sample(recording, reading)]),
      );
  }

  /** Whether `id` is the roast being saved right now (it can't be deleted until it ends). */
  isRecording(id: RoastId): boolean {
    return this.#recording?.savedId === id;
  }

  /** Resolves once every queued write has run. */
  flush(): Promise<void> {
    return this.#queue;
  }

  #start(state: RoastState, chargedAtMs: number): void {
    const since = state.preheatAtMs ?? chargedAtMs;
    const earlier = this.#deps.readingsSoFar().filter((r) => r.atMs >= since);
    const startedAt = this.#deps.nowIso();
    const created = this.#enqueue(() =>
      this.#deps.repository.create({ startedAt, mode: 'manual' }),
    );
    const recording: Recording = { chargedAtMs, id: created, eventsSaved: 0 };
    this.#recording = recording;
    this.#write(recording, async (id) => {
      recording.savedId = id;
      this.#deps.onSaved(id);
      return earlier.length > 0
        ? this.#deps.repository.addSamples(
            id,
            earlier.map((r) => this.#sample(recording, r)),
          )
        : { ok: true, value: undefined };
    });
  }

  #saveNewEvents(state: RoastState): void {
    const recording = this.#recording;
    if (!recording) return;
    for (const event of state.events.slice(recording.eventsSaved)) {
      const tS = toSeconds(event.atMs - recording.chargedAtMs);
      const patch = SUMMARY_FROM_EVENT[event.kind](tS, event, this.#deps.nowIso());
      this.#write(recording, async (id) => {
        const added = await this.#deps.repository.addEvent(id, {
          kind: event.kind,
          tS,
          bt: event.bt,
        });
        if (!added.ok || Object.keys(patch).length === 0) return added;
        const updated = await this.#deps.repository.update(id, patch);
        if (updated.ok && (event.kind === 'cool-end' || event.kind === 'end'))
          this.#deps.onSaved(id);
        return updated;
      });
    }
    recording.eventsSaved = state.events.length;
  }

  #sample(recording: Recording, reading: Reading): SavedSample {
    return { tS: toSeconds(reading.atMs - recording.chargedAtMs), values: reading.values };
  }

  /** Runs `write` after the roast row exists; skipped if it couldn't be created. */
  #write(recording: Recording, write: (id: RoastId) => Promise<Result<void, StorageError>>): void {
    this.#enqueue(async () => {
      const id = await recording.id;
      return id === undefined ? undefined : write(id);
    }).catch(() => undefined); // Never rejects: #enqueue logs every failure.
  }

  /**
   * Queues `task` after every earlier write. Resolves to its value, or undefined if it failed;
   * never rejects, so one bad write can't stop the ones after it.
   */
  #enqueue<T>(task: () => Promise<Result<T, StorageError> | undefined>): Promise<T | undefined> {
    const run = this.#queue.then(task).then(
      (result) => {
        if (result === undefined) return undefined;
        this.#writes.record(result);
        return result.ok ? result.value : undefined;
      },
      (error: unknown) => {
        this.#logger.error('history.write-threw', { error: serializeError(error) });
        return undefined;
      },
    );
    this.#queue = run.then(() => undefined);
    return run;
  }
}
