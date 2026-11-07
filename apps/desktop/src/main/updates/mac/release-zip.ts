import { err, ok, VersionSchema, type Result } from '@roastpilot/shared';
import type { ReleaseFile } from '../electron-updater-adapter';
import type { StepFailure } from './run-command';

/** The zip of a Mac release, as `latest-mac.yml` describes it. */
export interface ReleaseZip {
  /** Always under the release's own download address on GitHub, over HTTPS. */
  url: string;
  /** Base64 SHA-512. */
  sha512: string;
  size: number;
}

const DOWNLOAD_ROOT = 'https://github.com/mnabaci/Roastpilot/releases/download/v';

/** The zip for this Mac: an `arm64` one on Apple silicon, one without `arm64` on Intel. */
function pickZip(files: readonly ReleaseFile[], arch: string): ReleaseFile | undefined {
  const zips = files.filter((file) => file.url.endsWith('.zip'));
  const arm = (file: ReleaseFile) => file.url.includes('arm64');
  return arch === 'arm64' ? (zips.find(arm) ?? zips[0]) : zips.find((file) => !arm(file));
}

/** A file name resolved against the release, refused if it leads anywhere else. */
function releaseUrl(version: string, name: string): string | undefined {
  const base = `${DOWNLOAD_ROOT}${version}/`;
  let url: URL;
  try {
    url = new URL(name, base);
  } catch {
    return undefined; // Not an address at all: refused below, like any other.
  }
  const file = url.href.slice(base.length);
  const inRelease =
    url.protocol === 'https:' && url.href.startsWith(base) && /^[\w.-]+\.zip$/.test(file);
  return inRelease ? url.href : undefined;
}

/**
 * Which zip to download for `version`, from the files a check found. Refuses anything that isn't
 * a zip of this release on GitHub over HTTPS, or has no size or checksum to check it against.
 */
export function releaseZip(
  version: string,
  files: readonly ReleaseFile[],
  arch: string,
): Result<ReleaseZip, StepFailure> {
  if (!VersionSchema.safeParse(version).success)
    return err({ message: `Not a release version: ${version}` });
  const file = pickZip(files, arch);
  if (file === undefined) return err({ message: `The release has no zip for ${arch}` });
  const url = releaseUrl(version, file.url);
  if (url === undefined)
    return err({ message: `Refused a download outside the release: ${file.url}` });
  const { size, sha512 } = file;
  if (size === undefined || !Number.isInteger(size) || size <= 0 || sha512 === '')
    return err({ message: 'The release names no size or checksum for its zip' });
  return ok({ url, sha512, size });
}
