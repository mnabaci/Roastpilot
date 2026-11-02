// SessionStart hook: puts the rules summary into the agent's context.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
process.stdout.write(readFileSync(join(root, '.claude', 'rules-summary.md'), 'utf8'));
