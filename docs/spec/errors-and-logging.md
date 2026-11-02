# Errors and logging

A roaster that misbehaves must never fail silently. Every failure is either handled where it
happens, returned as a typed error, or logged with enough context to explain it afterwards.

## Errors

| Kind                                | Example                                 | How                                                                       |
| ----------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| Expected failure                    | Port missing, no reply, safety lock     | Typed `Result` (`DriverError`, `AcknowledgeError`), handled by the caller |
| Bad input at a boundary             | IPC payload, serial line, DB row        | Validated (zod, parsers); IPC rejects and logs, serial gives `bad-reply`  |
| Programmer error                    | Impossible state, contract broken       | Throw; caught and logged at the top level                                 |
| Anything unexpected in main         | Uncaught exception, unhandled rejection | Logged, then safe stop; an uncaught exception also exits the app          |
| Anything unexpected in the renderer | Script error, unhandled rejection       | Sent to main's log through `window.roastpilot.log`                        |

- **Never hidden.** No empty `catch`. A fire-and-forget promise always has a `.catch` that logs (ESLint: `no-floating-promises` without the `void` escape).
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
