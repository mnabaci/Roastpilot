# AI helpers

Two optional helpers read text for you: your tasting words become taste tags
([Taste → next roast](beans-favourites-ghost.md#taste--next-roast)), and a supplier's spec sheet
fills a bean's record ([Fill from a spec sheet](beans-favourites-ghost.md#fill-from-a-spec-sheet)).
Everything else works without them: tags can be tapped, beans typed. Decision: [ADR 0027](../adr/0027-ai-helpers-behind-a-text-reader.md).

## What AI does and doesn't do

- **Reads text into fixed shapes,** nothing else: words into tags from the fixed list, a sheet into bean fields. What comes back is checked like anything typed (zod, the bean form's limits); a value that doesn't pass is dropped.
- **Never decides a roast:** the profile change comes from the taste rules in `core`, the same with tags tapped or read. Nothing AI returns reaches the roaster, a profile or a saved record without your click.
- **Never mid-roast:** both helpers live in History and the bean editor.

## Turning it on

Settings › AI helpers, off by default:

| Row       | What it does                                                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Switch    | "Use AI to read words and spec sheets". Off: no field, button or call anywhere; the key stays saved                                                         |
| API key   | Your own Claude API key: a password field and Save; saved, it reads "Key saved · ends 4f2a" with Remove. Hint: "From console.anthropic.com · billed to you" |
| What goes | One line, always shown: "Your tasting words and spec sheets go to Anthropic. Roasts, beans and profiles stay on this computer."                             |

- The switch can't turn on without a saved key ("Save a key first").
- **The key** is encrypted with the computer's keychain (Electron `safeStorage`) into `ai-key.bin` in the user-data folder. Never in `settings.json`, the logs, an export or the renderer: the screen only learns whether one is saved and its last four characters. Where the keychain isn't available, Save is refused: "Can't store the key safely on this computer".

## Reading

- **One interface,** `TextReader` in `core` (types only), with `readTaste(words)` and `readSpecSheet(text | pdf)`, each returning a typed `Result`. The composition root registers one implementation: `ClaudeTextReader` in `apps/desktop` main. Another provider (another cloud model, a local one) is another implementation, nothing else changes.
- **Claude:** the official `@anthropic-ai/sdk`, model `claude-opus-5-5` at low effort, structured output against the zod schema of the result, server-side refusal fallback on. The model id is one constant.
- **Runs in main only;** the renderer asks over IPC and gets the checked result.
- **Sent:** the words, or the sheet's text or PDF, with a fixed instruction. Never a roast, bean, profile, name or file path.
- **Limits:** words up to 500 characters; pasted text up to 20,000; a PDF up to 10 MB and 20 pages. Over a limit nothing is sent: "Too long · up to 20 pages". One call per helper at a time; the button waits ("Reading…"). A call gives up after 30 s.

## When it fails

Shown inline where you asked, one line; nothing you typed is lost.

| Kind           | When                                  | Shown                                                                        |
| -------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| `no-key`       | Switch on, key gone                   | "No API key · add one in Settings"                                           |
| `key-refused`  | 401 or 403                            | "The API key was refused · check it in Settings"                             |
| `rate-limited` | 429                                   | "Too many requests · try again in a minute"                                  |
| `offline`      | No connection, or the 30 s ran out    | "Couldn't reach the AI · check your connection"                              |
| `unreadable`   | Refused, or nothing passed the checks | "Couldn't read that · tap the tags yourself" (or "fill the fields yourself") |
| `failed`       | Anything else from the API            | "The AI didn't answer · see Logs"                                            |

- Logged as `ai.read-failed` (scope `ai`) with the helper, the kind and the HTTP status; `ai.read` (debug) with the helper, size sent and duration. Never the key, the words or the sheet.
- The SDK's own retries (2) stay on; nothing else retries.
