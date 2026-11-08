---
name: merge
description: Merge main, a stack parent or another agent's branch into yours in Roastpilot, cleanly and with judgement: scan what git won't flag, keep both sides' intent, adapt or refactor what clashes with the branch's decisions, and stop to ask when two decisions disagree. Use for every branch-side git merge.
---

# Merge

For every `git merge` an agent runs: bringing main or the stack parent into a branch, combining
parallel agents' branches, and recovering after GitHub rebases a stack. (You never merge PRs on
GitHub: the maintainer does.) Never rebase, never force-push.

A clean merge is not one git accepts: it is one where both sides' decisions still hold, nothing is
duplicated or orphaned, and every rule in `AGENTS.md` still passes.

## 1. Before merging

- Working tree clean (`git status`), then `git fetch`.
- **Your remote moved under you?** (`git status -sb` says behind, e.g. GitHub rebased a stack
  after the bottom PR merged.) List local commits not on the remote
  (`git log origin/<branch>..HEAD`). Keep any that hold work; only then take the remote version
  (`git reset --hard origin/<branch>`) and merge those commits back. Never push over the remote.
- Know your side: `git log --oneline <base>..HEAD` and the spec/ADR changes on your branch.

## 2. Scan

`pnpm merge:scan <incoming>` (e.g. `origin/main`). It changes nothing and prints:

| Section                   | What to do with it                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Decisions changed         | Read every incoming spec, ADR, AGENTS, skill and brand-book change in full (step 3)   |
| Files both sides changed  | Review each after the merge, even when git merged it silently                         |
| Moved or deleted here     | Point the incoming code at the new place, or drop it if it duplicates yours           |
| Interfaces gained members | Pass the new member in every fake, caller and constructor on the other side           |
| Past ~200 lines           | Refactor in its own commit (`engineering-standards`), unless it was already over here |

## 3. Read the decisions, then sort every finding

Read the incoming decision files next to your branch's changes to the same places. Then each
finding falls in one case:

| Case                                    | Examples                                                                                                | Who decides                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Both can stay**                       | Moved or renamed code, a new dependency, both sides rewording one spec line, tests for code you moved   | You: keep both intents, your structure |
| **A rule breaks**                       | A file past ~200 lines, duplicated logic, design system or README screenshots out of step               | You: fix it (step 5)                   |
| **Two decisions disagree on behaviour** | Spec says X on one side, Y on the other; a safety or roasting-practice rule differs; both can't be kept | **Stop and ask**                       |

Asking: AskUserQuestion with plain context, both sides quoted, what happens with each, and a
recommendation. A decision already on `main` was approved by the maintainer, so it outweighs an
unmerged branch unless the branch exists to change it. Don't merge until it's answered.

## 4. Merge

```sh
git merge --no-edit <incoming>
```

Resolve conflicts keeping both intents, never by taking one side wholesale without reading the
other. The merge commit holds conflict resolutions only; its body lists one line per file
(`docs/spec/ui.md: branch's wording, main's "Step:" prefix`). Use the repo's identity and trailer
lines from `AGENTS.md`.

## 5. Adapt

Anything beyond resolving a conflict is its own conventional commit right after the merge, so a
reviewer can tell "resolved" from "changed" and revert one piece:

- `fix:` / `test:`: fakes and callers given a new member; incoming tests pointed at moved code.
- `refactor:`: duplicated logic folded into one place; a file brought back under ~200 lines.
- `docs:`: spec wording aligned across files; `docs/design-system` in step.
- `chore:` (or the feature's type): `pnpm screenshots` when a README scene changed.
- Remove what the merge made dead (old helpers, tests of behaviour that no longer exists).

## 6. Verify

- `pnpm check` passes.
- Review the files both sides changed with `code-review` (only those, not the whole diff).
- A UI change on both sides: `design-review` on that screen.

## 7. Finish

- `git push` (never `--force`). In a stack, merge each branch into the next one up, bottom-up,
  pushing each; re-link with `gh stack link <PRs bottom to top>`.
- Add a line to the PR body: `Merged main (#107): kept both copy namings; profile-service split`.
- Tell the maintainer, in one short list: each decision you made, each refactor, and any question
  still open.

## Don't

- Rebase, `--force`, or `git checkout --theirs/--ours` on a whole file you haven't read.
- Resolve a behaviour clash by picking a side yourself.
- Fold refactors into the merge commit.
- Merge a branch with failing checks into another branch.
