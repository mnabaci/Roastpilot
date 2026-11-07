# Security and safety policy

## Supported versions

Only the latest release (and `main`, until the first release) gets fixes.

## What to report privately

- Security bugs: anything that lets a file, page or other program run code in the app, read your
  data, or send commands to the roaster.
- **Safety bugs count as security bugs.** Anything that can leave the heater on, get past a safety
  rule (max temperature, lost connection, max roast time, the heater lock) or keep Auto heating
  after a stop. See [docs/spec/safety.md](docs/spec/safety.md) for what the rules promise.

If the roaster is heating unattended right now, switch it off at the wall first.

## How to report

Use GitHub's private vulnerability reporting: on this repository, **Security → Report a
vulnerability** ([direct link](https://github.com/mnabaci/Roastpilot/security/advisories/new)).
Please don't open a public issue, pull request or discussion for it.

Include what you did, what happened, the app version, OS, roaster, and a log excerpt from the
Logs screen if you have one.

## What to expect

- An acknowledgement within 7 days.
- A first assessment within 14 days, and updates as the fix progresses.
- Safety bugs are fixed first. We'll agree a disclosure date with you and credit you in the
  advisory unless you'd rather not be named.

Roastpilot is maintained by volunteers, so these are aims, not guarantees.
