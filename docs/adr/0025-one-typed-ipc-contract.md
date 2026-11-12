# 0025: One typed IPC contract

Status: accepted
Date: 2026-11-12

## Context

Each IPC call was written down four times: its channel in `IPC_CHANNELS`, its types in
`RoastpilotApi`, its line in the preload, and its handler in `createIpcHandlers`, plus a
hand-written channel list in the handlers' test. The preload's `ipcRenderer.invoke` returns `any`
and the handlers were a `Record<string, IpcHandler>` answering `unknown`, so a handler could
answer a different shape from the one the renderer expects, or be missing, and tsc said nothing.

## Decision

- **One map of types:** `InvokeContract` in `shared` gives each invoke channel its payload and
  result; `IpcEventPayloads` already did that for events. The channels are split into
  `INVOKE_CHANNELS`, `EVENT_CHANNELS` and `SEND_CHANNELS` (`IPC_CHANNELS` is all three), and a
  type check fails tsc when a channel list and its contract name different channels.
- **Handlers checked against it:** `IpcHandlers` is a mapped type over `InvokeContract`, so a
  missing, extra or wrong-shaped handler is a compile error. The payload stays `unknown` until its
  zod schema parses it, as before.
- **Renderer side from it:** the preload calls a generic `invoke(channel, ...payload)` typed by the
  contract (its one cast is where the renderer trusts main's answer), and `RoastpilotApi`'s calls
  are `Invoke<channel>`, so their payloads and results are the contract's.
- **Tests read it:** the handlers' test takes its channel list from `INVOKE_CHANNEL_LIST`; a
  type-level test proves a wrong handler result fails tsc.

## Consequences

- A call's types live in one place; tsc points at every side that is missing or wrong.
- `RoastpilotApi` reads a little less like plain method signatures: its doc comments stay, the
  types are `Invoke<typeof C.name>`.
- Runtime is unchanged: same channels, same zod validation, same sender check.
