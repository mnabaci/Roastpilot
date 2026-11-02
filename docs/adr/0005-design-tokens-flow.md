# 0005: Design tokens flow one way from the design system

Status: accepted
Date: 2026-11-02

## Context

One place to change the look; code and design never drift.

## Decision

The Roastpilot design system is the source of truth. Its `tokens.json` is copied to `packages/ui` (`sync-tokens` skill) and a script generates CSS variables and the Tailwind theme. Components use tokens only; ESLint blocks hex colours.

## Consequences

Token edits happen in the design system, not in code.
