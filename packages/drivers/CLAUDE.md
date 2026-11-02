# packages/drivers

RoasterDriver and Transport implementations: Skywalker TC4 adapter, simulator, serial transport.

May import: `core`, `shared`.

## Rules

- Implement `RoasterDriver` from `core`; never add roaster-specific code anywhere else.
- Declare channels (what you read, what you control, units, ranges, steps) instead of hard-coding UI.
- `safeStop()` must work even when the connection is half-broken. Test it.
- The simulator implements the same interface and is the default in development and tests.
- Protocol changes go through the `firmware-change` skill, with a protocol version bump.
