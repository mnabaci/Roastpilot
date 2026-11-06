# 0013: Roastpilot roast files, versioned JSON

Status: accepted
Date: 2026-11-06

## Context

History needs to export and import its own roasts in full (curve, events, weights, rating, notes, the profile copy), for backups, moving to another computer and sharing a roast. CSV loses the curve; Artisan's `.alog` loses our fields. Files will outlive the app version that wrote them, and ids mean nothing on another computer.

## Decision

A Roastpilot roast file is JSON: `{ format: "roastpilot-roasts", version: 1, exportedAt, roasts }`, each roast as `RoastDetail` without its ids, plus the bean's and roaster's names (`FileRoastSchema` in `@roastpilot/shared`). Import validates the whole file with zod and refuses a newer `version`; a roast whose start time is already in History is skipped. Imported roasts are marked (`roasts.imported`) and never move stock; beans and roasters link only by exact name.

## Consequences

- Backups and moves are complete and human-readable; a future version can read version 1 and migrate it.
- Changing the shape means bumping `version` and keeping a reader for every older one.
- Duplicate detection by start time is simple; two roasts charged in the same millisecond on different computers would be treated as one (practically never).
