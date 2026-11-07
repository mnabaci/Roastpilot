import { err, ok, type LogEntry, type Result, type UpdateStatus } from '@roastpilot/shared';
import { vi } from 'vitest';
import { ManualClock } from '../clock';
import { createLogger } from '../logging/logger';
import type { Updater, UpdaterEvent, UpdaterFailure } from './updater';
import { UpdateService } from './update-service';

/** 2026-11-07 14:02 UTC: wall-clock time when the test starts. */
export const WALL_START_MS = Date.UTC(2026, 10, 7, 14, 2);

/** A call the test answers when it wants to. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Answer<T> = Result<T, UpdaterFailure> | Error;

/** An updater whose answers are queued up front, or held until the test resolves them. */
export function fakeUpdater() {
  let listener: ((event: UpdaterEvent) => void) | undefined;
  const latest: Answer<string>[] = [];
  const downloads: Answer<void>[] = [];
  const held = { latest: deferred<Result<string, UpdaterFailure>>(), holdLatest: false };
  const heldDownload = { gate: deferred<Result<void, UpdaterFailure>>(), hold: false };
  const reply = <T>(queue: Answer<T>[], fallback: Result<T, UpdaterFailure>) => {
    const next = queue.shift() ?? fallback;
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  const updater = {
    latestVersion: vi.fn(() =>
      held.holdLatest ? held.latest.promise : reply(latest, ok('0.1.0')),
    ),
    download: vi.fn(() =>
      heldDownload.hold ? heldDownload.gate.promise : reply(downloads, ok(undefined)),
    ),
    quitAndInstall: vi.fn(),
    onEvent: vi.fn((next: (event: UpdaterEvent) => void) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    }),
  } satisfies Updater;
  return {
    updater,
    /** Queues the next answers to "what is the latest version?". */
    latest: (...answers: Answer<string>[]) => latest.push(...answers),
    downloads: (...answers: Answer<void>[]) => downloads.push(...answers),
    holdLatest: () => {
      held.holdLatest = true;
      held.latest = deferred();
      return held.latest;
    },
    holdDownload: () => {
      heldDownload.hold = true;
      heldDownload.gate = deferred();
      return heldDownload.gate;
    },
    emit: (event: UpdaterEvent) => listener?.(event),
    listening: () => listener !== undefined,
    fail: (message = 'net::ERR_INTERNET_DISCONNECTED') => err({ message }),
  };
}

export interface HarnessOptions {
  canInstall?: boolean;
  installedVersion?: string;
}

/** An UpdateService on fake time, a fake updater, and everything it said. */
export function updateHarness({
  canInstall = true,
  installedVersion = '0.1.0',
}: HarnessOptions = {}) {
  const clock = new ManualClock();
  const fake = fakeUpdater();
  const statuses: UpdateStatus[] = [];
  const logs: LogEntry[] = [];
  /** Wall time moves with the clock, plus whatever the computer slept through. */
  let sleptMs = 0;
  let roasting = false;
  let installable = canInstall;
  const service = new UpdateService({
    updater: fake.updater,
    clock,
    wallNowMs: () => WALL_START_MS + clock.now() + sleptMs,
    installedVersion,
    canInstall: () => installable,
    isRoasting: () => roasting,
    onStatus: (status) => statuses.push(status),
    logger: createLogger({ write: (entry) => logs.push(entry) }, 'updates'),
  });
  return {
    clock,
    service,
    ...fake,
    statuses,
    events: () => logs.map((entry) => entry.event),
    logs,
    /** The computer slept: wall time moved on, the monotonic clock didn't. */
    sleep: (ms: number) => {
      sleptMs += ms;
    },
    /** The app moved (or became read-only): asked again at the next check. */
    setCanInstall: (on: boolean) => {
      installable = on;
    },
    setRoasting: (on: boolean) => {
      roasting = on;
    },
    /** Lets queued promise callbacks run. */
    settle: () => clock.runFor(0),
  };
}
