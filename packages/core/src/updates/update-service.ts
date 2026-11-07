import {
  err,
  ok,
  type RestartToUpdateError,
  type Result,
  type UpdateStatus,
} from '@roastpilot/shared';
import type { Clock } from '../clock';
import type { Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';
import { UpdateSchedule } from './update-schedule';
import type { Updater, UpdaterEvent, UpdaterFailure } from './updater';
import { isNewerVersion } from './version';

export interface UpdateServiceDeps {
  updater: Updater;
  clock: Clock;
  /** Wall-clock milliseconds (epoch), for "checked 14:02" and the daily check. */
  wallNowMs: () => number;
  installedVersion: string;
  /**
   * Asked at each check: false when this copy can't replace itself (macOS from the DMG, a
   * translocated copy, a folder it can't write), so a newer version is only announced.
   */
  canInstall: () => boolean;
  /** Preheat to Cooling, or drum cooling: Restart to update waits. */
  isRoasting: () => boolean;
  onStatus: (status: UpdateStatus) => void;
  logger: Logger;
}

/** States in which a check would only repeat what is already under way or done. */
const BUSY: ReadonlySet<UpdateStatus['state']> = new Set(['checking', 'downloading', 'ready']);

/**
 * Checks for, downloads and installs updates without ever touching a roast
 * (docs/spec/install-and-update.md): failures are logged and shown, never thrown, and Restart to
 * update is refused while a roast runs.
 */
export class UpdateService {
  readonly #deps: UpdateServiceDeps;
  readonly #schedule: UpdateSchedule;
  readonly #stopListening: () => void;
  #status: UpdateStatus = { state: 'idle', checkedAt: null };
  /** The version whose install failed last run (macOS); never downloaded again this run. */
  #failedInstall: string | null = null;
  #disposed = false;

  constructor(deps: UpdateServiceDeps) {
    this.#deps = deps;
    this.#schedule = new UpdateSchedule({
      clock: deps.clock,
      wallNowMs: deps.wallNowMs,
      check: () => this.check(),
    });
    this.#stopListening = deps.updater.onEvent((event) => {
      this.#onEvent(event);
    });
  }

  get status(): UpdateStatus {
    return this.#status;
  }

  /** Starts the schedule: 10 s from now, then daily. */
  start(): void {
    this.#schedule.run().catch((error: unknown) => {
      this.#deps.logger.error('update.schedule-failed', { error: serializeError(error) });
    });
  }

  /** The computer woke up: checks once if a day has passed meanwhile. */
  wake(): void {
    if (!this.#schedule.due()) return;
    this.check().catch((error: unknown) => {
      this.#deps.logger.error('update.check-crashed', { error: serializeError(error) });
    });
  }

  /** Checks now; does nothing while a check, a download or an install is under way. Never rejects. */
  async check(): Promise<void> {
    if (this.#disposed || BUSY.has(this.#status.state)) return;
    this.#schedule.checked();
    // A version already out stays on screen while the daily check looks again: no flicker.
    const shown = this.#status.state === 'available' ? this.#status.version : null;
    const quiet = shown !== null;
    if (!quiet) this.#set({ state: 'checking' });
    const latest = await this.#attempt(() => this.#deps.updater.latestVersion());
    if (this.#isDisposed()) return;
    if (!latest.ok) {
      this.#deps.logger.warn('update.check-failed', { error: latest.error });
      if (!quiet) this.#set({ state: 'failed', stage: 'check' });
      return;
    }
    const version = latest.value;
    if (!isNewerVersion(version, this.#deps.installedVersion)) {
      this.#set({ state: 'idle', checkedAt: new Date(this.#deps.wallNowMs()).toISOString() });
      return;
    }
    // Installing this version failed last time: downloading it again would fail at every quit.
    const reason = !this.#deps.canInstall()
      ? 'cant-replace'
      : version === this.#failedInstall
        ? 'install-failed'
        : undefined;
    if (reason !== undefined) {
      if (shown !== version) this.#deps.logger.info('update.available', { version, reason });
      this.#set({ state: 'available', version, reason });
      return;
    }
    await this.#download(version);
  }

  /** Quits and installs the downloaded update, unless a roast runs or nothing is ready. */
  restart(): Result<void, RestartToUpdateError> {
    if (this.#status.state !== 'ready' || !this.#deps.canInstall())
      return err({ kind: 'not-ready' });
    if (this.#deps.isRoasting()) {
      this.#deps.logger.info('update.restart-refused', { reason: 'roasting' });
      return err({ kind: 'roasting' });
    }
    this.#deps.logger.info('update.restarting', { version: this.#status.version });
    try {
      this.#deps.updater.quitAndInstall();
      return ok(undefined);
    } catch (error) {
      this.#deps.logger.error('update.install-failed', { error: serializeError(error) });
      return err({ kind: 'install-failed' });
    }
  }

  /**
   * The last install (macOS: the swap after quitting) failed, as main read from its log: shown as
   * "Couldn't update" until the next check, which offers that version as a Download instead of
   * downloading it again. Ignored once a check runs.
   */
  installFailed(detail: { version: string | null; reason: string }): void {
    if (this.#disposed || this.#status.state !== 'idle' || this.#status.checkedAt !== null) return;
    this.#failedInstall = detail.version;
    this.#deps.logger.warn('update.last-install-failed', detail);
    this.#set({ state: 'failed', stage: 'install' });
  }

  /** No more checks or events. */
  dispose(): void {
    this.#disposed = true;
    this.#schedule.stop();
    this.#stopListening();
  }

  async #download(version: string): Promise<void> {
    this.#deps.logger.info('update.downloading', { version });
    this.#set({ state: 'downloading', version, percent: 0 });
    const downloaded = await this.#attempt(() => this.#deps.updater.download());
    if (this.#isDisposed()) return;
    if (!downloaded.ok) {
      this.#deps.logger.warn('update.download-failed', { version, error: downloaded.error });
      this.#set({ state: 'failed', stage: 'download' });
      return;
    }
    this.#ready(version);
  }

  #onEvent(event: UpdaterEvent): void {
    if (this.#disposed) return;
    const status = this.#status;
    if (event.kind === 'progress') {
      if (status.state === 'downloading')
        this.#set({ ...status, percent: Math.min(100, Math.max(0, Math.round(event.percent))) });
      return;
    }
    if (!this.#deps.canInstall()) {
      this.#deps.logger.warn('update.downloaded-ignored', { version: event.version });
      return;
    }
    if (status.state === 'downloading' && status.version === event.version)
      this.#ready(event.version);
  }

  #ready(version: string): void {
    if (this.#status.state === 'ready') return;
    this.#deps.logger.info('update.ready', { version });
    this.#set({ state: 'ready', version });
  }

  /** The updater's call as a result, even if it throws instead of failing. */
  async #attempt<T>(
    call: () => Promise<Result<T, UpdaterFailure>>,
  ): Promise<Result<T, UpdaterFailure>> {
    try {
      return await call();
    } catch (error) {
      return err({ message: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Read fresh after an await: dispose may have run meanwhile (TypeScript can't see that). */
  #isDisposed(): boolean {
    return this.#disposed;
  }

  #set(status: UpdateStatus): void {
    if (JSON.stringify(status) === JSON.stringify(this.#status)) return;
    this.#status = status;
    this.#deps.onStatus(status);
  }
}
