import type { Result } from '@roastpilot/shared';

/** Why the updater couldn't do something: offline, GitHub down, a bad download. */
export interface UpdaterFailure {
  message: string;
}

/** What the updater says on its own while it works. */
export type UpdaterEvent =
  | { kind: 'progress'; percent: number }
  /** A download finished, possibly one from an earlier run. */
  | { kind: 'downloaded'; version: string };

/**
 * The platform's updater (electron-updater in the app), narrowed to what `UpdateService` needs.
 * It never downloads or installs on its own: the service decides (docs/spec/install-and-update.md).
 */
export interface Updater {
  /** The newest release's version (`X.Y.Z`); a failure when it can't be asked. */
  latestVersion(): Promise<Result<string, UpdaterFailure>>;
  /** Downloads the release the last check found. */
  download(): Promise<Result<void, UpdaterFailure>>;
  /** Quits the app and runs the installer. Throws when the installer can't start. */
  quitAndInstall(): void;
  /** Returns a function that stops listening. */
  onEvent(listener: (event: UpdaterEvent) => void): () => void;
}
