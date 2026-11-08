# 0021: One Roastpilot file shape for every kind

Status: accepted
Date: 2026-11-08

## Context

Only roasts export today (`.rpr`, `{ format: "roastpilot-roasts", version, exportedAt, roasts }`,
ADR 0015). Beans, profiles and roasters need export and import too, so a profile can go to a
friend and a roaster's settings to a new computer. Files outlive the app version that wrote them,
so their shape is hard to change once people keep them.

## Decision

- Every kind uses the roast file's envelope: `{ format, version, exportedAt, <items> }`, one
  `.rpr` extension, `format` naming the kind (`roastpilot-beans`, `-profiles`, `-roasters`,
  `-roasts`) and `version` counting per kind. Roast files stay as they are (version 2).
- Files hold °C, grams and seconds always; the °F setting only changes what the screen shows.
- Ids never travel; links go by name. Same name and content is skipped; same name with other
  content comes in as "<name> (imported)". Nothing is overwritten.
- One import path in `apps/desktop/src/main`: read the file, check the envelope, then hand the
  items to the kind's reader. A file of another kind is refused by name.

## Consequences

- One menu, one toast and one set of rules to learn on every screen; one tested envelope reader.
- A kind's shape can change on its own by raising its `version`; older versions keep importing.
- No whole-library backup yet: moving computers means exporting four files. A backup file can
  later hold the four lists in the same envelope (`roastpilot-backup`).
