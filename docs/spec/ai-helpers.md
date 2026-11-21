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

A provider describes itself in its own module in main: its id, its name, the company it sends to, where you get a key, and the readers it has (tasting words, spec sheets, or both). Main registers the providers at startup, in order, and sends that list to the screens (`listAiProviders`), each with whether its key is saved. No screen, line or setting names a provider: Settings, the "what goes where" line and every message are built from the list. A new provider is one module and one line in `ai-wiring.ts`.

| Registered now     | Reads                         | Key from              |
| ------------------ | ----------------------------- | --------------------- |
| Claude (Anthropic) | Tasting words and spec sheets | console.anthropic.com |
| Jev (TypeSafe)     | Tasting words                 | console.typesafe.ai   |

Jev answers yes/no and pick-one questions, so it can't read numbers and names off a sheet, and it doesn't take PDFs: it registers a taste reader only.

## Turning it on

Settings › AI helpers, off by default, one row per registered provider:

| Row                     | What it does                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Switch                  | "Use AI to read words and spec sheets". Off: no field, button or call anywhere; keys stay saved                                                                                       |
| <Provider> API key      | A password field and Save; saved, "Saved · ends 4f2a" with Replace (a new key over it; the old one stays until Save) and Remove (asks first). Hint: "From <key host> · billed to you" |
| Read tasting words with | Only with two or more providers that read tasting words: a segmented control of them, choosable once two have keys ("Add a second key to choose"); it shows the one actually used     |
| What goes               | One line, always shown, from the providers in use: "Tasting words go to TypeSafe, spec sheets to Anthropic. Roasts, beans and profiles stay on this computer."                        |

- The switch can't turn on without at least one key ("Save a key first").
- **Who reads:** tasting words go to the chosen provider while it has a key, else the first registered that can; spec sheets to the first registered that reads them and has a key. **Which helpers show:** each while some provider for it has a key.
- **Keys** are encrypted with the computer's keychain (Electron `safeStorage`), one file per provider in the user-data folder (`ai-key-<id>.bin`), only for a registered provider. Printable characters only, no spaces ("A key has no spaces or line breaks"). Never in `settings.json`, the logs, an export or the renderer: the screen only learns whether one is saved and its last four characters. Where the keychain isn't available, Save is refused: "Can't store the key safely on this computer".
- **Hosts:** each provider's client is given its own host, so no environment variable can send a key elsewhere.

## Reading

- **Two interfaces** in `core` (types only), so a provider can do one job: `TasteReader.readTaste(words)` → tags, and `SpecSheetReader.readSpecSheet(text | pdf)` → bean fields, each returning a typed `Result`. A registered provider has one or both. An answer that arrives after the helpers were turned off is dropped (`off`).
- **Claude** (`ClaudeReader`, both): the official `@anthropic-ai/sdk`, model `claude-opus-5-5` at low effort, structured output against the zod schema of the result, server-side refusal fallback on.
- **Jev** (`JevTasteReader`): the official `@typesafe-ai/sdk`, model `jev-1.14.0`; the words are the state, and each taste tag is one Noul question ("Do these tasting notes describe sourness or a sharp, sour acidity?", with what counts as yes and no). All tags in one request, answered in parallel; a tag is ticked at 0.6 or more, a starting guess to revisit.
- Each model id is one constant, in its reader.
- **Runs in main only;** the renderer asks over IPC and gets the checked result.
- **Sent:** the words, or the sheet's text or PDF, with fixed instructions. Never a roast, bean, profile, name or file path.
- **Limits:** words up to 500 characters; pasted text up to 20,000; a PDF up to 10 MB and 20 pages. Over a limit nothing is sent: "Too long · up to 20 pages". One call per helper at a time; the button waits ("Reading…"). A call gives up after about 30 s: two tries of 15 s each, under one hard stop at 30 s whatever a server's retry-after asks.
- **Read ticks nothing:** "Nothing to tick from those words" (not an error).

## When it fails

Shown inline where you asked, one line; nothing you typed is lost. Both providers map to the same kinds.

| Kind           | Claude                                           | Jev                               | Shown                                                                        |
| -------------- | ------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------- |
| `no-key`       | Key gone                                         | Key gone                          | "No API key · add one in Settings"                                           |
| `key-refused`  | 401 or 403                                       | 401                               | "The API key was refused · check it in Settings"                             |
| `rate-limited` | 429                                              | 429, 529                          | "Too many requests · try again in a minute"                                  |
| `offline`      | No connection, or the 30 s ran out               | The same                          | "Couldn't reach the AI · check your connection"                              |
| `unreadable`   | Refused, cut short, or nothing passed the checks | An answer missing or out of range | "Couldn't read that · tap the tags yourself" (or "fill the fields yourself") |
| `failed`       | Anything else                                    | Anything else (400, 422, …)       | "The AI didn't answer · see Logs"                                            |

- Logged as `ai.read-failed` (scope `ai`) with the helper, the provider, the kind and the HTTP status; `ai.read` (debug) with the helper, the provider, size sent and duration. Never a key, the words or the sheet.
- Each SDK retries a failed try once (Jev also on 529); nothing else retries.
