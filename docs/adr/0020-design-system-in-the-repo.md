# 0020: The design system lives in the repo

Status: accepted
Date: 2026-11-08

## Context

The design system's guidelines (the brand book, each component's rules and preview) lived only on a private claude.ai page that only its owner can edit. Copilot, Codex and contributors can't read or change it, so a component changed in a PR without its guidelines, and the page drifted from the code: by version 51 it still described button sizes, the coach card's spacing, the output slider's type and the toast's width as they were before. [ADR 0005](0005-design-tokens-flow.md) made that page the source of truth and copied its tokens into the repo; with the page out of reach, that direction can't hold.

## Decision

- The repo is the source of truth for the design system:
  - `docs/design-system/README.md`: the brand book (principles, voice, colour, type, layout, charts, icons).
  - `docs/design-system/components/<Name>/README.md` and `preview.html`: each component's guidelines and a static preview in plain HTML and CSS, no build step.
  - `packages/ui/tokens.json`: the tokens, the only copy; `pnpm --filter @roastpilot/ui tokens` generates the CSS.
  - Storybook (`pnpm storybook`): the live components.
- A component's guidelines change in the same PR as the component.
- The claude.ai page is a read-only view, regenerated from the repo with `/design-sync` after merges. Nobody edits the page by hand; a change made there is lost on the next sync.
- This supersedes ADR 0005: tokens now flow from `packages/ui/tokens.json` to the page, not the other way.

## Consequences

- Anyone with the repo (people and agents) can read and change the guidelines, and review them in the PR beside the code.
- Drift shows in review: a component change without its README change is visible.
- The page can lag the repo until someone runs `/design-sync`; the repo wins when they differ.
- Previews are static drawings, so they can disagree with the component; Storybook shows the truth.
