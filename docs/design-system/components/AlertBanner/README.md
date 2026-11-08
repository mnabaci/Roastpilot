# AlertBanner

A full-width banner for things that need attention without blocking the roast.

## Kinds

- **Critical** (safety trip, lost connection): `critical-surface` background, 1px `critical` border, `critical-text` icon. Stays until dismissed or resolved; plays a sound.
- **Warning** (stalled temperature, low stock): `surface-raised` background, 1px `warning` border, `warning` icon.
- **Info** (why something waits, never a problem: "Auto is running this profile · edits save after Drop"): `surface-raised` background, 1px `air` border, Lucide `Info` icon in `air`, as Auto is what runs. No sound, no dismiss: it goes when the state does.

## Rules

- `role="alert"` for critical, `role="status"` for warning and info.
- One line of text, weight 600, starting with what happened, then what the app did: "Emergency stop · heater off, fan and bean cooler on".
- Acknowledge is an Outline button, 44px high, so it reads as a button on the red ground. Never a modal.
