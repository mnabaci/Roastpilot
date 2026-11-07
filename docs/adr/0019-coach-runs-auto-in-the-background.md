# 0019: The coach runs Auto in the background

Status: accepted
Date: 2026-11-07

## Context

In a manual roast the coach suggests heater and fan settings ([manual-mode.md](../spec/manual-mode.md#coach)). Its advice could come from rules of its own (a target gap, an RoR band) or from Auto's controller. Two sources of advice would disagree: switching to Auto mid-roast would do something the coach never suggested. Auto's heat control also keeps state (a PID's integral, a curve's slew) that assumes its own output reached the roaster, which isn't true while you drive by hand.

## Decision

- The coach runs a `RoastRun` for the profile picked for Auto, from Start, fed the same readings as Auto. Its heater and fan are the suggestion; nothing is sent.
- Whenever you set the heater, its heat control restarts from your setting (`restartControl`, as Resume auto does), so the state never winds up against outputs it didn't set.
- What the card says is decided by `CoachRule`s, in order, the first with something to say wins: the setting suggestion, then the first-crack and drop heads-ups. New tips are new rules, registered at startup ([extensibility.md](../spec/extensibility.md)).
- The coach is pure `core`: no timers, no I/O. Main feeds it readings and owns Apply, through the same output path as the sliders.

## Consequences

- Tuning Auto tunes the coach too; a profile that needs calibration gives advice that does too, which the card says.
- Restarting from your heater means a curve phase's suggestion grows 5 % per 10 s from your setting (ADR 0016), so it speaks up about 20 s after a gap opens, not at once.
- Auto's soak (heater fixed after charge) is not advice for a manual charge, which usually goes in with the heat on: the setting rule stays quiet until the soak ends.
- A rule that wants to suggest something Auto wouldn't do has to be a new `CoachRule`, never a change to Auto.
