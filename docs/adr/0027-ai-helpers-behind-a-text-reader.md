# 0027: AI helpers behind a text reader

Status: proposed
Date: 2026-11-21

## Context

Two jobs are slow by hand and easy to get wrong: turning "tart, a bit hay-like" into what to change
next roast, and typing a supplier's spec sheet into a bean. A language model reads both well. But
Roastpilot runs a heater, works offline, keeps its data on the computer, and must give advice a
roaster can trust and repeat. A model that decides roast changes, runs mid-roast or needs an
account would break all of that.

## Decision

- **AI reads, rules decide.** AI only turns text into fixed shapes: taste tags from a fixed list,
  bean fields. The profile change comes from `TasteRule`s in `core`, the same whether the tags
  were tapped or read. Everything AI returns is checked with zod like typed input.
- **One interface,** `TextReader` in `core` (types only), implemented in `apps/desktop` main and
  registered at startup. A second implementation is planned (a local model through an
  OpenAI-style server such as Ollama or Jan), so this is an extension point, not a guess.
- **First provider: Claude, with the roaster's own API key,** through the official
  `@anthropic-ai/sdk` (model `claude-opus-5-5`, low effort, structured output, refusal fallback).
  No Roastpilot server, account or billing.
- **Off by default.** The key is encrypted with the OS keychain (`safeStorage`), never in
  `settings.json`, logs, exports or the renderer. Only the words or the sheet are sent; roasts,
  beans and profiles never leave the computer.
- **Not mid-roast:** History and the bean editor only.

## Consequences

- Every feature works without AI: tags are tapped, beans typed. AI saves typing; it adds no
  behaviour that only AI can reach.
- Advice is testable and the same every time; the taste rules are plain data to revise.
- One new dependency in main, and a network call that can fail: each failure is a typed result
  shown in one line ([ai-helpers.md](../spec/ai-helpers.md#when-it-fails)).
- Roasters pay their own API costs, a few pence a month; a hosted option later is another
  `TextReader`, not a rewrite.
- A local provider will read PDFs less well; it may send the PDF's extracted text instead.
