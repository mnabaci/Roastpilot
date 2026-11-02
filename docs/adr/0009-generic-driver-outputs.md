# 0009: One generic output method on RoasterDriver

Status: accepted
Date: 2026-11-02

## Context

The spec listed fixed setters (`setHeater`, `setFan`, `setCooling`), but drivers also declare their
channels so the UI adapts. The Skywalker has drum and filter outputs too, and another roaster may
have no fan. Fixed setters mean editing the interface for every new kind of output.

## Decision

`RoasterDriver` has `channels`, `connect`, `read`, `setOutput(channel, value)` and `safeStop`.
Outputs are addressed by the channel ids the driver declares. Expected failures are typed results;
`safeStop` never fails.

## Consequences

New outputs need no interface change, and the IPC `setOutput` maps straight onto the driver.
Callers must use a declared channel id; the driver rejects unknown ids with a typed error.
