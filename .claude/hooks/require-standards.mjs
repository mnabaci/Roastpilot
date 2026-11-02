// PreToolUse hook (Edit/Write/MultiEdit/NotebookEdit).
// Blocks the first file edit of each session once, asking the agent to load the
// engineering-standards skill first. Later edits in the same session pass through.
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let session = 'unknown';
  try {
    session = JSON.parse(input).session_id ?? 'unknown';
  } catch {
    // Missing or invalid input: fall back to one marker for all sessions.
  }
  const marker = join(tmpdir(), `roastpilot-standards-${session}`);
  if (existsSync(marker)) process.exit(0);
  writeFileSync(marker, '');
  process.stderr.write(
    'Roastpilot: before the first edit in this session, load the engineering-standards skill and follow its checklist. Then retry this edit.\n',
  );
  process.exit(2);
});
