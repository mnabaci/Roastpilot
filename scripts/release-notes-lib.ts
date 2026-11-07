// Pure helpers for the release workflow (docs/spec/install-and-update.md, Releases): the tag must
// match the app's version, and the release notes are that version's CHANGELOG section.

/** `v0.2.0` (or `refs/tags/v0.2.0`) → `0.2.0`; undefined for anything else. */
export function versionOfTag(tag: string): string | undefined {
  return /^(?:refs\/tags\/)?v(\d+\.\d+\.\d+)$/.exec(tag)?.[1];
}

/**
 * The body of `## [X.Y.Z]` (with or without a date after it), up to the next `## ` heading or the
 * link references at the end; undefined when there is no such section or it is empty.
 */
export function changelogSection(changelog: string, version: string): string | undefined {
  const lines = changelog.split(/\r?\n/);
  const heading = `## [${version}]`;
  const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} `));
  if (start === -1) return undefined;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ') || /^\[[^\]]+\]:\s/.test(line)) break;
    body.push(line);
  }
  const text = body.join('\n').trim();
  return text === '' ? undefined : text;
}

export type ReleaseNotes =
  { ok: true; version: string; notes: string } | { ok: false; error: string };

/** Checks the tag against the app's version and finds its notes: the release workflow's gate. */
export function releaseNotes({
  tag,
  appVersion,
  changelog,
}: {
  tag: string;
  appVersion: string;
  changelog: string;
}): ReleaseNotes {
  const version = versionOfTag(tag);
  if (version === undefined) return { ok: false, error: `${tag} is not a vX.Y.Z tag.` };
  if (version !== appVersion)
    return {
      ok: false,
      error: `Tag ${tag} doesn't match apps/desktop/package.json version ${appVersion}.`,
    };
  const notes = changelogSection(changelog, version);
  if (notes === undefined)
    return { ok: false, error: `CHANGELOG.md has no "## [${version}]" section with notes.` };
  return { ok: true, version, notes };
}
