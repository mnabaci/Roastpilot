---
name: challenge
description: Challenge a Roastpilot request from roasters' and users' points of view before building it, so the app doesn't drift from its purpose. Use on any request that changes what users see or do (UI, UX, functionality), before plan-feature or code, and on your own options before offering them.
---

# Challenge

The maintainer wants every user-facing decision pushed back on, theirs included. Measure it
against [Who it's for and What it isn't](../../../docs/spec/overview.md#who-its-for), not
your own taste.

1. **Restate** the request in one line: what changes for whom.
2. **Look through three users:**
   - **Home roaster** at the machine, mid-roast, eyes on the beans.
   - **Small roasting business** on its own roaster, staff who aren't experts, the same coffee
     batch after batch, a record of every batch.
   - **First-time user** who wants a safe first roast within minutes.
3. **Ask of each:**
   - Does it help the job they hire Roastpilot for?
   - Is there more to read, click or decide during a roast?
   - Does it work on any roaster record, not just the Skywalker?
   - Is it a setting where a good default would do?
   - Does it match roasting practice (`docs/spec/roast-control.md`)? Get the facts right first.
   - Does it hit a "What it isn't"?
4. **Verdict:**
   - **Fits:** one line, then carry on: `Challenge: fits; staff can repeat a batch from it.`
   - **Concern:** stop and ask (AskUserQuestion): the concern in plain words, from whose point of
     view, a better option (recommended), as asked, and drop it. Give each one's outcome and an
     example.
5. **Overruled:** if the user keeps a request that hits a "What it isn't", update that section
   of `overview.md` in the same PR, so the drift is on purpose and written down.
