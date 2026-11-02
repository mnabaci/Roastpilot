# 0006: Handle room conditions with the PID alone

Status: superseded by 0008
Date: 2026-11-02

## Context

The user roasts indoors and outdoors and back to back; a weather API would be wrong indoors, and extra checks add complexity. The integral term absorbs steady heat loss.

## Decision

No weather data and no pre-roast heat checks. The PID reacts live to the roaster sensor.

## Consequences

The first minute or two may trail the curve slightly. If it matters, carry the integral over from the previous roast.
