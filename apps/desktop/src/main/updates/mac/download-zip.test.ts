import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadZip, type DownloadDeps } from './download-zip';

const BYTES = Buffer.from('a zip of the new Roastpilot, in three chunks');
const SHA = createHash('sha512').update(BYTES).digest('base64');
const ZIP = { url: 'https://github.com/x.zip', sha512: SHA, size: BYTES.length };

/** A body that sends the bytes in chunks, then optionally breaks. */
function body(bytes: Buffer, breakAfter?: number) {
  const chunks = [bytes.subarray(0, 10), bytes.subarray(10, 20), bytes.subarray(20)];
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (breakAfter !== undefined && sent === breakAfter) {
        controller.error(new Error('net::ERR_CONNECTION_RESET'));
        return;
      }
      const next = chunks[sent++];
      if (next === undefined) controller.close();
      else controller.enqueue(new Uint8Array(next));
    },
  });
}

const answer = (stream: ReadableStream<Uint8Array>, status = 200) =>
  vi.fn(() => Promise.resolve(new Response(stream, { status })));

let dir: string;
let file: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rp-download-'));
  file = join(dir, 'Roastpilot-0.2.0.zip');
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function deps(fetch: DownloadDeps['fetch'], more: Partial<DownloadDeps> = {}) {
  const progress: number[] = [];
  return { progress, deps: { fetch, onProgress: (p: number) => progress.push(p), ...more } };
}

describe('downloadZip', () => {
  it('writes the zip when size and SHA-512 match, with progress up to 100', async () => {
    const { deps: d, progress } = deps(answer(body(BYTES)));
    expect(await downloadZip(ZIP, file, d)).toEqual({ ok: true, value: undefined });
    expect(await readFile(file)).toEqual(BYTES);
    expect(progress.at(-1)).toBe(100);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  it('a checksum that does not match deletes the file: verify', async () => {
    const { deps: d } = deps(answer(body(BYTES)));
    const result = await downloadZip({ ...ZIP, sha512: 'other==' }, file, d);
    expect(result).toMatchObject({ ok: false, error: { kind: 'verify' } });
    expect(existsSync(file)).toBe(false);
  });

  it('a smaller file than the release says deletes it: verify', async () => {
    const { deps: d } = deps(answer(body(BYTES)));
    const result = await downloadZip({ ...ZIP, size: BYTES.length + 5 }, file, d);
    expect(result).toMatchObject({ ok: false, error: { kind: 'verify' } });
    expect(existsSync(file)).toBe(false);
  });

  it('a larger file stops as soon as it passes the size: verify', async () => {
    const { deps: d } = deps(answer(body(BYTES)));
    const result = await downloadZip({ ...ZIP, size: 15 }, file, d);
    expect(result).toMatchObject({ ok: false, error: { kind: 'verify' } });
    expect(existsSync(file)).toBe(false);
  });

  it('a connection cut mid-download leaves no partial file', async () => {
    const { deps: d } = deps(answer(body(BYTES, 2)));
    const result = await downloadZip(ZIP, file, d);
    expect(result).toEqual({
      ok: false,
      error: { kind: 'download', message: 'net::ERR_CONNECTION_RESET' },
    });
    expect(existsSync(file)).toBe(false);
  });

  it('offline: the request itself fails', async () => {
    const { deps: d } = deps(
      vi.fn(() => Promise.reject(new Error('net::ERR_INTERNET_DISCONNECTED'))),
    );
    expect(await downloadZip(ZIP, file, d)).toMatchObject({
      ok: false,
      error: { kind: 'download' },
    });
  });

  it('GitHub answering an error status is a failed download', async () => {
    const { deps: d } = deps(answer(body(BYTES), 404));
    expect(await downloadZip(ZIP, file, d)).toEqual({
      ok: false,
      error: { kind: 'download', message: 'GitHub answered 404' },
    });
    expect(existsSync(file)).toBe(false);
  });

  it('a redirect off HTTPS is refused', async () => {
    const response = new Response(body(BYTES));
    Object.defineProperty(response, 'url', { value: 'http://objects.example/x.zip' });
    const { deps: d } = deps(vi.fn(() => Promise.resolve(response)));
    expect(await downloadZip(ZIP, file, d)).toMatchObject({
      ok: false,
      error: { kind: 'download' },
    });
  });

  it('a full disk (the write fails) leaves no file and says why', async () => {
    const full = () =>
      new Writable({
        write(_chunk, _encoding, done) {
          done(Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }));
        },
      });
    const { deps: d } = deps(answer(body(BYTES)), { openWrite: full });
    expect(await downloadZip(ZIP, file, d)).toEqual({
      ok: false,
      error: { kind: 'download', message: 'ENOSPC: no space left on device' },
    });
    expect(existsSync(file)).toBe(false);
  });
});
