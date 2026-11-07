import { describe, expect, it } from 'vitest';
import { releaseZip } from './release-zip';

const ROOT = 'https://github.com/mnabaci/Roastpilot/releases/download/v0.2.0/';
const ZIP = { url: 'Roastpilot-0.2.0-arm64-mac.zip', sha512: 'abc==', size: 120 };
const DMG = { url: 'Roastpilot-0.2.0-arm64.dmg', sha512: 'def==', size: 140 };

describe('releaseZip', () => {
  it('takes the zip, not the DMG, resolved against the release on GitHub', () => {
    expect(releaseZip('0.2.0', [DMG, ZIP], 'arm64')).toEqual({
      ok: true,
      value: { url: `${ROOT}Roastpilot-0.2.0-arm64-mac.zip`, sha512: 'abc==', size: 120 },
    });
  });

  it('accepts the full release address too', () => {
    const full = { ...ZIP, url: `${ROOT}Roastpilot-0.2.0-arm64-mac.zip` };
    expect(releaseZip('0.2.0', [full], 'arm64').ok).toBe(true);
  });

  it('picks the zip for this Mac', () => {
    const intel = { ...ZIP, url: 'Roastpilot-0.2.0-mac.zip' };
    expect(releaseZip('0.2.0', [intel, ZIP], 'arm64')).toMatchObject({
      value: { url: `${ROOT}Roastpilot-0.2.0-arm64-mac.zip` },
    });
    expect(releaseZip('0.2.0', [ZIP, intel], 'x64')).toMatchObject({
      value: { url: `${ROOT}Roastpilot-0.2.0-mac.zip` },
    });
    expect(releaseZip('0.2.0', [ZIP], 'x64')).toMatchObject({ ok: false });
  });

  it.each([
    ['plain http', 'http://github.com/mnabaci/Roastpilot/releases/download/v0.2.0/R.zip'],
    ['another host', 'https://evil.example/mnabaci/Roastpilot/releases/download/v0.2.0/R.zip'],
    ['another repo', 'https://github.com/someone/Roastpilot/releases/download/v0.2.0/R.zip'],
    ['another release', 'https://github.com/mnabaci/Roastpilot/releases/download/v0.1.0/R.zip'],
    ['climbing out', '../v0.1.0/R.zip'],
    ['a sub-folder', 'more/R.zip'],
    ['a query', 'R.zip?x=1.zip'],
    ['a file scheme', 'file:///etc/R.zip'],
  ])('refuses %s', (_name, url) => {
    expect(releaseZip('0.2.0', [{ ...ZIP, url }], 'arm64')).toMatchObject({ ok: false });
  });

  it('refuses a zip without a size or checksum, and a version that is not X.Y.Z', () => {
    expect(releaseZip('0.2.0', [{ url: ZIP.url, sha512: 'abc==' }], 'arm64').ok).toBe(false);
    expect(releaseZip('0.2.0', [{ ...ZIP, size: 0 }], 'arm64').ok).toBe(false);
    expect(releaseZip('0.2.0', [{ ...ZIP, sha512: '' }], 'arm64').ok).toBe(false);
    expect(releaseZip('0.2.0/../x', [ZIP], 'arm64').ok).toBe(false);
    expect(releaseZip('0.2.0', [], 'arm64').ok).toBe(false);
  });
});
