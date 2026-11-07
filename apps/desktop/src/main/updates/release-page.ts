import { serializeError, type Logger } from '@roastpilot/core';
import {
  err,
  ok,
  VersionSchema,
  type OpenReleasePageError,
  type ReleasePage,
  type Result,
  type UpdateStatus,
} from '@roastpilot/shared';

const RELEASE_TAG_URL = 'https://github.com/mnabaci/Roastpilot/releases/tag/v';
const RELEASE_PAGE = /^https:\/\/github\.com\/mnabaci\/Roastpilot\/releases\/tag\/v\d+\.\d+\.\d+$/;

/** The GitHub release page of `version`; undefined for anything that isn't `X.Y.Z`. */
export function releasePageUrl(version: string): string | undefined {
  return VersionSchema.safeParse(version).success ? `${RELEASE_TAG_URL}${version}` : undefined;
}

/** Only Roastpilot's own release pages ever open in the browser. */
export function isReleasePageUrl(url: string): boolean {
  return RELEASE_PAGE.test(url);
}

export interface ReleasePageDeps {
  installedVersion: string;
  status: () => UpdateStatus;
  /** Electron's shell.openExternal. */
  openExternal: (url: string) => Promise<void>;
  logger: Logger;
}

/**
 * Opens What's new (`installed`) or the newer version that is out (`latest`). The address is built
 * here from a version, never taken from the renderer.
 */
export async function openReleasePage(
  page: ReleasePage,
  { installedVersion, status, openExternal, logger }: ReleasePageDeps,
): Promise<Result<void, OpenReleasePageError>> {
  const current = status();
  const version =
    page === 'installed'
      ? installedVersion
      : current.state === 'available' || current.state === 'ready'
        ? current.version
        : undefined;
  const url = version === undefined ? undefined : releasePageUrl(version);
  if (url === undefined || !isReleasePageUrl(url)) {
    logger.warn('update.release-page-refused', { page, version: version ?? null });
    return err({ kind: 'no-release' });
  }
  try {
    await openExternal(url);
    return ok(undefined);
  } catch (error) {
    logger.error('update.release-page-failed', { url, error: serializeError(error) });
    return err({ kind: 'open-failed' });
  }
}
