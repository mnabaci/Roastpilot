#!/usr/bin/env bash
# PreToolUse hook (Edit/Write/MultiEdit/NotebookEdit).
# Blocks the first file edit of each session once, asking the agent to load the
# engineering-standards skill first. Later edits in the same session pass through.
input=$(cat)
session=$(printf '%s' "$input" | node -e '
let d = "";
process.stdin.on("data", (c) => (d += c)).on("end", () => {
  try { console.log(JSON.parse(d).session_id || "unknown"); } catch { console.log("unknown"); }
});')
marker="${TMPDIR:-/tmp}/roastpilot-standards-${session}"
if [ -f "$marker" ]; then
  exit 0
fi
touch "$marker"
echo "Roastpilot: before the first edit in this session, load the engineering-standards skill and follow its checklist. Then retry this edit." >&2
exit 2
