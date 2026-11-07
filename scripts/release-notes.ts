// Release gate and notes for .github/workflows/release.yml: fails when the tag doesn't match
// apps/desktop/package.json or CHANGELOG.md has no section for it; otherwise writes the section.
//
// Run with: node scripts/release-notes.ts --tag v0.2.0 --out release-notes.md
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { releaseNotes } from './release-notes-lib.ts';

const root = join(import.meta.dirname, '..');
const { values } = parseArgs({
  options: { tag: { type: 'string' }, out: { type: 'string' } },
});
if (values.tag === undefined || values.out === undefined) {
  process.stderr.write('Usage: node scripts/release-notes.ts --tag vX.Y.Z --out <file>\n');
  process.exit(2);
}
const pkg = JSON.parse(readFileSync(join(root, 'apps/desktop/package.json'), 'utf8')) as {
  version: string;
};
const result = releaseNotes({
  tag: values.tag,
  appVersion: pkg.version,
  changelog: readFileSync(join(root, 'CHANGELOG.md'), 'utf8'),
});
if (!result.ok) {
  process.stderr.write(`${result.error}\n`);
  process.exit(1);
}
writeFileSync(values.out, `${result.notes}\n`, 'utf8');
process.stdout.write(`Release notes for ${result.version} written to ${values.out}\n`);
