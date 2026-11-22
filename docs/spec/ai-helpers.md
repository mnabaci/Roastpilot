# AI helpers

Two optional helpers read text for you: your tasting words become taste tags
([Taste → next roast](beans-favourites-ghost.md#taste--next-roast)), and a supplier's spec sheet
fills a bean's record ([Fill from a spec sheet](beans-favourites-ghost.md#fill-from-a-spec-sheet)).
Everything else works without them: tags can be tapped, beans typed. Decision: [ADR 0027](../adr/0027-ai-helpers-behind-readers.md).

## What AI does and doesn't do

- **Reads text into fixed shapes,** nothing else: words into tags from the fixed list, a sheet into bean fields. What comes back is checked like anything typed (zod, the bean form's limits); a value that doesn't pass is dropped.
- **Never decides a roast:** the profile change comes from the taste rules in `core`, the same with tags tapped or read. Nothing AI returns reaches the roaster, a profile or a saved record without your click.
- **Never mid-roast:** both helpers live in History and the bean editor.

## Providers

A provider describes itself in its own module in main: its id, its name, the company it sends to, where you get a key, and the readers it has (tasting words, spec sheets, or both), each with the models it reads with. Main registers the providers at startup, in order, and sends that list to the screens (`listAiProviders`), each with whether its key is saved. No screen, line or setting names a provider: Settings, its "Who reads what" card and every message are built from the list. A new provider is one module and one line in `ai-wiring.ts`.

| Registered now     | Tasting words          | Spec sheets           | Key from              |
| ------------------ | ---------------------- | --------------------- | --------------------- |
| Claude (Anthropic) | Haiku 5.5, then Sonnet | Opus 5.5, then Sonnet | console.anthropic.com |
| Jev (TypeSafe)     | Jev 1.14               | –                     | console.typesafe.ai   |

Jev answers yes/no and pick-one questions, so it can't read numbers and names off a sheet, and it doesn't take PDFs: it registers a taste reader only.

## Models

- **Each job has its own models,** first to last, set in the provider's module: the smallest that does the job well first. Tags from a few words are light work (Claude: Haiku 5.5, about 40× cheaper than Opus); a sheet, often a PDF, needs a careful read (Opus 5.5). Settings shows the first model of each job.
- **A retired model is passed over:** when the provider answers 404 (Claude: `not_found_error`; Jev: `NotFoundError`), the read asks the job's next model and logs `ai.model-gone` with the model. Host and path are fixed by the SDK, so a 404 is taken as the model; a 404 for anything else would end the same way, at "update Roastpilot". A model the key's account can't use looks the same, so nothing is remembered between reads: a new key may reach the first model again.
- **All of a provider's models gone:** the read moves on to the next provider with a key for that job (tasting words: the other provider); with none left, it fails as `model-retired`, "This AI model was retired · update Roastpilot". Before each next provider the helpers must still be on (else `off`) and its key is read afresh (a key removed meanwhile is skipped): nothing is sent after you turn them off or remove a key.
- **One hard stop per read:** 30 s, set when the read starts and passed to every provider and model it asks; past it, no next provider is asked (`offline`).
- **Never "latest":** models are fixed ids, never an alias that moves (`jev-latest`), so a new model is tested before it reads anyone's words. A release adds the newer model at the front of the chain (`release` skill checks the lists).
- Settings never offers a model picker: which model suits a job is the provider module's call, not the roaster's.

## Turning it on

Settings › AI helpers, off by default, one row per registered provider:

| Row                | What it does                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Switch             | "Use AI helpers", hint "Tasting notes into taste tags · a supplier's spec sheet into a bean's details". Off: no field, button or call anywhere; keys stay saved                       |
| <Provider> API key | A password field and Save; saved, "Saved · ends 4f2a" with Replace (a new key over it; the old one stays until Save) and Remove (asks first). Hint: "From <key host> · billed to you" |

Then a second card, **Who reads what**, one row per job some provider can do:

| Row           | Hint                                                    | Right                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tasting words | Where they go and the model: "To Anthropic · Haiku 5.5" | With two or more providers that read them: a segmented control, choosable once two have keys ("· a second key lets you choose"); it shows the one actually used. Else the provider's name |
| Spec sheets   | "To Anthropic · Opus 5.5"                               | The provider's name                                                                                                                                                                       |

With no key for a job: "Nothing sent · add a key that reads them", and a dash (no choice to make yet).

**ⓘ beside the switch and each job** (an InfoButton, on click): what it does, where you use it, and what it sends, in three short lines (`ai-info.ts`). Tasting words: write how a roast tasted and Read ticks the matching taste tags, which suggest the next roast's change; History › a roast › Roast details › Taste › In your words; only those words, up to 500 characters. Spec sheets: a supplier's sheet as PDF or pasted text fills the bean's fields for you to check before Save; Beans › Add bean, or a bean's Edit › Fill from spec sheet; only the sheet, up to 20 pages or 20,000 characters. The switch: the two helpers, with your own key; nothing they return is saved or changes a profile until you click, never mid-roast; off, tap tags and type details yourself. Under the cards, one line: "Roasts, beans and profiles stay on this computer."

- The switch can't turn on without at least one key (its hint ends "· save a key first").
- **Who reads:** tasting words go to the chosen provider while it has a key, else the first registered that can; spec sheets to the first registered that reads them and has a key. **Which helpers show:** each while some provider for it has a key.
- **Keys** are encrypted with the computer's keychain (Electron `safeStorage`), one file per provider in the user-data folder (`ai-key-<id>.bin`), only for a registered provider. Printable characters only, no spaces ("A key has no spaces or line breaks"). Never in `settings.json`, the logs, an export or the renderer: the screen only learns whether one is saved and its last four characters. Where the keychain isn't available, Save is refused: "Can't store the key safely on this computer".
- **Hosts:** each provider's client is given its own host, so no environment variable can send a key elsewhere.

## Reading

- **Two interfaces** in `core` (types only), so a provider can do one job: `TasteReader.readTaste(words, key, signal)` → tags, and `SpecSheetReader.readSpecSheet(text | pdf, key, signal)` → bean fields (`signal` is the read's one hard stop), each returning a typed `Result`. A registered provider has one or both. An answer that arrives after the helpers were turned off is dropped (`off`).
- **Claude** (`ClaudeReader`, one per job): the official `@anthropic-ai/sdk`; tasting words by `claude-haiku-5-5`, spec sheets by `claude-opus-5-5`, either falling back to `claude-sonnet-5-5` ([Models](#models)); low effort, structured output against the zod schema of the result, and the server-side refusal fallback on the models that take it (not Haiku).
- **Jev** (`JevTasteReader`): the official `@typesafe-ai/sdk`, model `jev-1.14.0`; the words are the state, and each taste tag is one Noul question ("Do these tasting notes describe sourness or a sharp, sour acidity?", with what counts as yes and no). All tags in one request, answered in parallel; a tag is ticked at 0.6 or more, a starting guess to revisit.
- Each job's model list is one constant, in its provider's module (`claude-models.ts`, `jev-taste-reader.ts`).
- **Runs in main only;** the renderer asks over IPC and gets the checked result.
- **Sent:** the words, or the sheet's text or PDF, with fixed instructions. Never a roast, bean, profile, name or file path.
- **Limits:** words up to 500 characters; pasted text up to 20,000; a PDF up to 10 MB and 20 pages. Over a limit nothing is sent: "Too long · up to 20 pages". One call per helper at a time; the button waits ("Reading…"). A call gives up after about 30 s: two tries of 15 s each, under one hard stop at 30 s whatever a server's retry-after asks.
- **Read ticks nothing:** "Nothing to tick from those words" (not an error).

## When it fails

Shown inline where you asked, one line; nothing you typed is lost. Both providers map to the same kinds.

| Kind            | Claude                                              | Jev                               | Shown                                                                                       |
| --------------- | --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| `no-key`        | Key gone                                            | Key gone                          | "No API key · add one in Settings"                                                          |
| `key-refused`   | 401 or 403                                          | 401                               | "The API key was refused · check it in Settings"                                            |
| `rate-limited`  | 429                                                 | 429, 529                          | "Too many requests · try again in a minute"                                                 |
| `offline`       | No connection, or the 30 s ran out                  | The same                          | "Couldn't reach the AI · check your connection"                                             |
| `unreadable`    | Refused, cut short, or nothing passed the checks    | An answer missing or out of range | "Couldn't read that · tap the tags yourself" (or "fill the fields yourself")                |
| `model-retired` | Every model of the job answered 404 "no such model" | Its model answered 404            | "This AI model was retired · update Roastpilot" (after any other provider with a key tried) |
| `failed`        | Anything else                                       | Anything else (400, 422, …)       | "The AI didn't answer · see Logs"                                                           |

- Logged as `ai.read-failed` (scope `ai`) with the helper, the provider, the kind and the HTTP status; `ai.model-gone` (warn) with the model passed over; `ai.read` (debug) with the helper, the provider, size sent and duration. Never a key, the words or the sheet.
- Each SDK retries a failed try once (Jev also on 529); nothing else retries.
