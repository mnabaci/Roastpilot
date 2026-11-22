# 0027: AI helpers behind readers

Status: proposed
Date: 2026-11-21

## Context

Two jobs are slow by hand and easy to get wrong: turning "tart, a bit hay-like" into what to change
next roast, and typing a supplier's spec sheet into a bean. AI reads both well. But Roastpilot runs
a heater, works offline, keeps its data on the computer, and must give advice a roaster can trust
and repeat. A model that decides roast changes, runs mid-roast or needs an account would break all
of that.

Providers differ in what they can read. Claude writes structured output from text and PDFs, so it
can do both jobs. Jev (TypeSafe) answers typed questions (yes/no, pick one) with calibrated
probabilities: well suited to "which taste tags do these words describe", cheap and fast, but it
can't pull numbers and names off a sheet and doesn't take PDFs.

## Decision

- **AI reads, rules decide.** AI only turns text into fixed shapes: taste tags from a fixed list,
  bean fields. The profile change comes from `TasteRule`s in `core`, the same whether the tags
  were tapped or read. Everything AI returns is checked with zod like typed input.
- **One interface per job,** `TasteReader` and `SpecSheetReader` in `core` (types only), so a
  provider implements only what it can do. Implementations live in `apps/desktop` main.
- **Providers describe themselves.** Each provider's module exports its id, name, company, key
  host and readers; main registers them at startup and sends the list to the screens. Nothing
  else names a provider: Settings, its lines and the messages are built from the list.
- **Two providers, each with the roaster's own key:** Claude (`@anthropic-ai/sdk`, low effort,
  structured output, refusal fallback where the model takes it) reads both; Jev
  (`@typesafe-ai/sdk`, one Noul question per tag) reads tasting words. A setting picks the taste
  reader. No Roastpilot server, account or billing.
- **Models per job, in a fixed list:** each provider module lists its models per job, cheapest
  that does the job first (Claude: Haiku 5.5 for tasting words, Opus 5.5 for sheets, Sonnet 5.5
  behind both; Jev: 1.14). A model the API says doesn't exist is passed over for the next, then
  the next provider; none left is `model-retired`. Never a moving alias like `jev-latest`: a
  model reads roasters' words only once a release has tested it.
- **Off by default.** Keys are encrypted with the OS keychain (`safeStorage`), one file per
  provider, never in `settings.json`, logs, exports or the renderer. Only the words or the sheet
  are sent; roasts, beans and profiles never leave the computer.
- **Not mid-roast:** History and the bean editor only.

## Consequences

- Every feature works without AI: tags are tapped, beans typed. AI saves typing; it adds no
  behaviour that only AI can reach.
- Advice is testable and the same every time; the taste rules are plain data to revise.
- Two dependencies in main and network calls that can fail: each failure maps to one typed kind
  shown in one line, the same for both providers ([ai-helpers.md](../spec/ai-helpers.md#when-it-fails)).
- Roasters pay their own API costs, pennies a month. A local or hosted provider later is another
  reader, not a rewrite.
- Jev's 0.6 tick threshold is a starting guess; tasted roasts will tell whether to move it.
- Model retirement is a release chore, not an outage: providers announce it months ahead, the
  `release` skill checks each list, and the fallback chain keeps the helpers working meanwhile.
