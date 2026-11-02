# 0001: Monorepo with pnpm workspaces

Status: accepted
Date: 2026-11-02

## Context

The roasting logic must stay independent of Electron so it can be tested in isolation and reused by a phone app later. Package boundaries are enforced by ESLint.

## Decision

One Electron app and five packages (`core`, `drivers`, `storage`, `shared`, `ui`) in a pnpm workspace.

## Consequences

More `package.json` files to maintain. Workspace packages export TypeScript source, so there is no build step per package; electron-vite bundles them.
