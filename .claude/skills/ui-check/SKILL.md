---
name: ui-check
description: Run the Roastpilot app on a throwaway data folder with the debug port, drive it on the Simulator, screenshot it at 960 × 640 and 1600 × 1000 in both themes, then stop it. Use to see a UI change in the real app, or for design-review.
---

# UI check

Never run the app on the user's real data folder: every run gets a fresh temp folder.

## Start

1. **Port free?** `curl -s http://127.0.0.1:9222/json` must fail. If it answers, another check is running: wait for it (one app at a time, `AGENTS.md` › Parallel work).
2. **Temp folder:** an absolute path, e.g. `mktemp -d "${TMPDIR:-/tmp}/roastpilot-ui-XXXXXX"` (Windows: `New-Item -ItemType Directory "$env:TEMP\roastpilot-ui-<n>"`).
3. **Start the app** in the background, with a long timeout (it keeps running across steps), from the repo root:
   `ROASTPILOT_USER_DATA=<temp folder> pnpm dev --remoteDebuggingPort 9222 > <temp folder>.log 2>&1`
   (Windows: `$env:ROASTPILOT_USER_DATA='<temp folder>'; pnpm dev --remoteDebuggingPort 9222`).
4. **Wait** until `curl -s http://127.0.0.1:9222/json` lists the `Roastpilot` page. Check the folder took: `<temp folder>/logs/*.log` has `app.user-data-override`. No such line: stop now, the real folder may be in use.

## Drive (`pnpm ui`, `scripts/ui/`)

| Command                                                                                 | Does                                                                              |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm ui eval '<expression>'`                                                           | evaluates in the window (promises awaited), prints the JSON result                |
| `pnpm ui click '<label>' ['<label>'…]`                                                  | clicks buttons, tabs, options or links by exact text, in order                    |
| `pnpm ui scroll-end ['<heading>']`                                                      | scrolls the scroller around a heading (or every scroller) to the end              |
| `pnpm ui shot <file.png> [--width 960 --height 640 --scale 1 --scroll-end '<heading>']` | sizes the page to exactly width × height, prints the overflow checks, saves a PNG |

All take `--port <n>` (default 9222). A fresh folder starts on the safety notice:

```sh
pnpm ui click 'I understand · continue'
pnpm ui click Simulator Connect      # Roasters › Simulator › Connect, then Roast opens
pnpm ui click Roasters
pnpm ui shot <scratch>/roasters-960x640-dark.png
pnpm ui shot <scratch>/roasters-1600x1000-dark.png --width 1600 --height 1000
pnpm ui click Settings Appearance Light Roasters   # then the same shots in Light
```

## Check

- **README scenes:** after a screen change, run `pnpm screenshots` and read every changed `docs/images/*.png` for clipping, artefacts and stale copy. A scene's moment or clicks change in `apps/desktop/src/screenshots/scenes.ts` or `sample-world.ts`, never in the PNGs. No app or data folder needed: it renders the screens from sample data.

- Every screen the change touches, at 960 × 640 and 1600 × 1000, in Dark and Light. Scroll long screens to the end too.
- `noSideScroll` and `noPageScroll` must both be `true` in every shot's output.
- **Open and look at every screenshot** (read the PNG). Then measure what should line up (`design-review` › Measure).
- Screenshots go to your scratch folder, never into the repo.

## Stop

1. Disconnect the roaster (`pnpm ui click Disconnect`).
2. Stop the background `pnpm dev` (stop the task, or `Ctrl+C`); check `curl -s http://127.0.0.1:9222/json` fails, so the next check can start.
3. Delete the temp folder and its log.
