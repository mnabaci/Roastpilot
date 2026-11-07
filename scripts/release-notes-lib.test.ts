import { describe, expect, it } from 'vitest';
import { changelogSection, releaseNotes, versionOfTag } from './release-notes-lib.ts';

const CHANGELOG = `# Changelog

## [Unreleased]

- Something not out yet.

## [0.2.0] - 2026-11-20

### Added

- **Updates:** Settings › About checks for new versions.

### Fixed

- A fix.

## [0.1.0] - 2026-11-07

- First release.

[0.2.0]: https://github.com/mnabaci/Roastpilot/releases/tag/v0.2.0
[0.1.0]: https://github.com/mnabaci/Roastpilot/releases/tag/v0.1.0
`;

describe('versionOfTag', () => {
  it.each([
    ['v0.2.0', '0.2.0'],
    ['refs/tags/v1.10.3', '1.10.3'],
    ['0.2.0', undefined],
    ['v0.2', undefined],
    ['v0.2.0-beta.1', undefined],
    ['release-0.2.0', undefined],
  ])('%s → %s', (tag, version) => {
    expect(versionOfTag(tag)).toBe(version);
  });
});

describe('changelogSection', () => {
  it('is the body under the version heading, up to the next one', () => {
    expect(changelogSection(CHANGELOG, '0.2.0')).toBe(
      '### Added\n\n- **Updates:** Settings › About checks for new versions.\n\n### Fixed\n\n- A fix.',
    );
  });

  it('stops at the link references at the end', () => {
    expect(changelogSection(CHANGELOG, '0.1.0')).toBe('- First release.');
  });

  it('reads Windows line endings', () => {
    expect(changelogSection(CHANGELOG.replaceAll('\n', '\r\n'), '0.1.0')).toBe('- First release.');
  });

  it('is undefined for a version with no section, an empty one, or a prefix match', () => {
    expect(changelogSection(CHANGELOG, '0.3.0')).toBeUndefined();
    expect(changelogSection('## [0.3.0]\n\n## [0.2.0]\n- x', '0.3.0')).toBeUndefined();
    expect(changelogSection('## [0.2.0.1]\n- x', '0.2.0')).toBeUndefined();
  });
});

describe('releaseNotes', () => {
  it('passes a tag that matches the version and has notes', () => {
    expect(releaseNotes({ tag: 'v0.1.0', appVersion: '0.1.0', changelog: CHANGELOG })).toEqual({
      ok: true,
      version: '0.1.0',
      notes: '- First release.',
    });
  });

  it('fails a tag that does not match the app version, before anything is built', () => {
    expect(releaseNotes({ tag: 'v0.2.0', appVersion: '0.1.0', changelog: CHANGELOG })).toEqual({
      ok: false,
      error: "Tag v0.2.0 doesn't match apps/desktop/package.json version 0.1.0.",
    });
  });

  it('fails a tag with no CHANGELOG section', () => {
    expect(releaseNotes({ tag: 'v0.3.0', appVersion: '0.3.0', changelog: CHANGELOG })).toEqual({
      ok: false,
      error: 'CHANGELOG.md has no "## [0.3.0]" section with notes.',
    });
  });

  it('fails a tag that is not vX.Y.Z', () => {
    expect(releaseNotes({ tag: 'v0.3.0-rc.1', appVersion: '0.3.0', changelog: CHANGELOG })).toEqual(
      { ok: false, error: 'v0.3.0-rc.1 is not a vX.Y.Z tag.' },
    );
  });
});
