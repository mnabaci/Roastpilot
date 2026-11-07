# Errors and logging

A roaster that misbehaves must never fail silently. Every failure is either handled where it
happens, returned as a typed error, or logged with enough context to explain it afterwards.

## Errors

| Kind                                | Example                                            | How                                                                                                                     |
| ----------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Expected failure                    | Port missing, no reply, safety lock                | Typed `Result` (`DriverError`, `AcknowledgeError`), handled by the caller                                               |
| Bad input at a boundary             | IPC payload, serial line, DB row                   | Validated (zod, parsers); IPC rejects and logs, serial gives `bad-reply`                                                |
| A call from outside the app         | An IPC call from a frame that isn't the app's page | Refused before anything runs, logged once as `ipc.sender-refused`                                                       |
| Programmer error                    | Impossible state, contract broken                  | Throw; caught and logged at the top level                                                                               |
| Anything unexpected in main         | Uncaught exception, unhandled rejection            | Logged, then safe stop; an uncaught exception also tries to save the roast in progress (within 2 s), then exits the app |
| Anything unexpected in the renderer | Script error, unhandled rejection                  | Sent to main's log through `window.roastpilot.log`                                                                      |
| A screen fails to draw              | A render error in one screen                       | That screen shows its error page; logged as `renderer.screen-failed`                                                    |
| The app frame fails to draw         | A render error outside the screens                 | The whole-window error page; logged as `renderer.app-failed`                                                            |

- **Never hidden.** No empty `catch`. A fire-and-forget promise always has a `.catch` that logs (ESLint: `no-floating-promises` without the `void` escape).
- **Seen, not just logged.** A user action that fails or is refused where the screen shows nothing (a click whose IPC call rejects, a save main refused) shows an error toast as well as being logged ([ui.md](ui.md), Toasts); one the screen already explains inline isn't toasted twice.
- **Safety wins.** A safety rule that throws is logged and treated as tripped, so a bug in safety code stops the roaster instead of crashing the caller. A crashed poll loop is logged, and the lost-connection rule still safe-stops.
- **Listeners can't break the core.** A listener that throws (a window closing mid-send) is logged; polling and safety carry on.
- **Edge cases are tested:** timeouts, disconnects mid-call, bad or missing input, calls during other calls, quitting at any moment.

## Logging

- **Interface in `core`:** `Logger` with `debug`, `info`, `warn`, `error` and `child(scope)`. It is injected like the `Clock`, so `core` stays pure; components default to a silent logger in tests.
- **Outputs are an extension point:** a `LogSink` per destination (file, dev terminal; later remote), combined with `fanOut` and filtered with `withMinLevel`. A failing sink never stops the others and never throws into the caller.
- **Non-blocking:** a log call only queues the entry and returns; sinks write in the background.
- **Entries:** one event name per thing that happened (`session.connect-failed`), a scope (`session`, `driver.tc4`, `ipc`) and a context object. Errors in the context are written with name, message and stack.
- **What to log:** every failure, every state change (connection, safety trips and clears, lock, emergency stop), app start and quit. Not every reading (they belong in the roast database); a repeating failure is logged when it starts and when it ends, not every second.
- **No `console`** in app code (ESLint `no-console`). Scripts may print.

### Files

- JSON lines, one file per day: `roastpilot-YYYY-MM-DD.log` in the OS log folder (`app.getPath('logs')`: `~/Library/Logs/Roastpilot` on macOS, `%APPDATA%\Roastpilot\logs` on Windows).
- Written through a buffered async stream, so logging never blocks the roaster loop. The stream is flushed before quit, and before exit on a crash, so the last lines still reach disk.
- Kept for 7 days; older files are deleted at start.
- Level `info` and up in the packaged app, `debug` and up in `pnpm dev`. In dev, warnings and errors are also printed to the terminal.

### Viewer

A **Logs** screen in the app, next to Roast and Settings, so a trip or a failed connect can be explained without leaving the app.

| Part   | What it does                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------- |
| Day    | Today by default; any of the 7 kept days, from one "Day ▾" chip                                             |
| Levels | Error, Warning, Info, Debug chips; opens on Error and Warning                                               |
| Scope  | A chip per scope in the day (`app.session`, `renderer`, ...); none picked means all                         |
| Search | Text in the event, scope or context                                                                         |
| List   | Newest first: time, level, event, scope and a one-line context. Open an entry for its full context and Copy |
| Live   | Today's list gets new entries as they are written, through a `LogSink` that sends them to the windows       |
| Folder | "Open log folder" opens it in Finder or Explorer, for sending the files                                     |

- Reads at most the last 2,000 entries of a day; a line that isn't valid JSON is skipped and counted ("3 lines unreadable").
- The day is validated as `YYYY-MM-DD` before any file is opened, so the renderer can't read other files.
- The live sink never logs its own failures (that would loop); they go to stderr like any failing sink.
