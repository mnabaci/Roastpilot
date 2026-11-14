---
name: firmware-change
description: Change the SkyCommand sketch together with the Roastpilot driver and protocol version. Use for any change to the serial protocol or firmware.
---

# Firmware change

1. Describe the change in `docs/spec/hardware.md` (commands, replies, timing).
2. Edit the sketch in `firmware/skywalker-tc4/`, keeping the upstream credit and license notice.
3. Bump the protocol version in `firmware/skywalker-tc4/README.md` and in the SkyCommand dialect (`packages/drivers/src/skywalker.ts`, `SKYWALKER_PROTOCOL_VERSION`).
4. Make the driver check the version on connect and refuse to roast on a mismatch with a clear banner.
5. Update `SimulatedDriver` so it speaks the new protocol, and the driver tests.
6. Note flashing steps in the PR description.
