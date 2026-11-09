---
name: plan-feature
description: Plan a new Roastpilot feature spec-first. Use when asked to add or change behaviour, before writing code.
---

# Plan a feature

1. Restate the feature in one sentence and list what the user will see or do. Run `challenge` on it
   first; a concern is settled with the user before planning.
2. Read the affected `docs/spec/*.md` files and the root `AGENTS.md`.
3. Ask the user only about choices that change behaviour; propose a recommended option for each.
4. Update the spec: edit the right file(s) in `docs/spec/`, keep the style (tables, short bullets, no walls of text). Add a new file only for a new area, and link it from `docs/spec/README.md`.
5. If a choice is hard to reverse (new dependency, data model shape, new extension point), write an ADR from `docs/adr/template.md` and link it in `docs/adr/README.md`.
6. Write a task list: one task per package touched, in dependency order (`shared` → `core` → `drivers`/`storage` → `ui` → `apps/desktop`), each with its tests.
7. Stop and show the plan before implementing.
