# 0007: Tooling baseline for long-term maintenance

Status: accepted
Date: 2026-11-02

## Context

The app will grow for years and be worked on by agents as well as by hand. Mistakes that tools can catch should never reach review.

## Decision

- TypeScript 6 strict, one shared base config, a runtime-specific config per package (pure ES for `core`/`shared`, Node for `drivers`/`storage`, DOM + React for `ui` and the renderer).
- ESLint 9 with type-aware typescript-eslint, package boundaries, React hooks, jsx-a11y and fast-refresh rules; Prettier owns formatting.
- Vitest with two projects: Node for logic, jsdom + Testing Library for React.
- husky + lint-staged on commit, commitlint for conventional commits, Dependabot for grouped weekly updates.
- CI on Ubuntu and Windows.

## Consequences

Stricter rules mean a little more typing up front and fewer bugs later. ESLint stays on 9 until jsx-a11y supports 10; TypeScript stays on 6 until typescript-eslint supports 7.
