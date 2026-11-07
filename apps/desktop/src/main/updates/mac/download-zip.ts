import { err, ok, type Result } from '@roastpilot/shared';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { Readable, Transform, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { errorMessage } from '../electron-updater-adapter';
import type { ReleaseZip } from './release-zip';
import type { StepFailure } from './run-command';

/** Why a download didn't count: it didn't arrive (`download`), or it isn't what the release says. */
export interface DownloadFailure extends StepFailure {
  kind: 'download' | 'verify';
}

export interface DownloadDeps {
  /** Electron's net.fetch in the app (follows GitHub's redirect to its file host). */
  fetch: (url: string) => Promise<Response>;
  /** Percent of the size received so far. */
  onProgress: (percent: number) => void;
  /** Where the bytes go; a file in the app, something that fails in tests (a full disk). */
  openWrite?: (file: string) => Writable;
}

const failed = (kind: DownloadFailure['kind'], message: string): Result<never, DownloadFailure> =>
  err({ kind, message });

/**
 * Streams the release zip into `file`, hashing as it goes. Counts only when the size and the
 * SHA-512 match `latest-mac.yml`; otherwise, or when it is cut off, nothing is left behind.
 */
export async function downloadZip(
  zip: ReleaseZip,
  file: string,
  { fetch, onProgress, openWrite = (path) => createWriteStream(path) }: DownloadDeps,
): Promise<Result<void, DownloadFailure>> {
  let response: Response;
  try {
    response = await fetch(zip.url);
  } catch (error) {
    return failed('download', errorMessage(error));
  }
  if (!response.ok || response.body === null)
    return failed('download', `GitHub answered ${String(response.status)}`);
  if (response.url !== '' && !response.url.startsWith('https:'))
    return failed('download', `Refused a redirect off HTTPS: ${response.url}`);
  const hash = createHash('sha512');
  let received = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      received += chunk.length;
      // More than the release says: stop now rather than fill the disk.
      if (received > zip.size) {
        done(new Error(`Larger than the ${String(zip.size)} bytes the release names`));
        return;
      }
      hash.update(chunk);
      onProgress((received / zip.size) * 100);
      done(null, chunk);
    },
  });
  const body = Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>);
  try {
    await pipeline(body, meter, openWrite(file));
  } catch (error) {
    await rm(file, { force: true });
    return failed(received > zip.size ? 'verify' : 'download', errorMessage(error));
  }
  if (received !== zip.size) {
    await rm(file, { force: true });
    return failed('verify', `Size ${String(received)} is not the ${String(zip.size)} expected`);
  }
  if (hash.digest('base64') !== zip.sha512) {
    await rm(file, { force: true });
    return failed('verify', 'SHA-512 does not match the release');
  }
  return ok(undefined);
}
