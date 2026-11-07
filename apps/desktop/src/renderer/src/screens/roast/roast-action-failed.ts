import type { RoastAction } from '@roastpilot/shared';

const WHAT: Readonly<Record<RoastAction, string>> = {
  preheat: 'start preheat',
  start: 'start the roast',
  'first-crack': 'mark first crack',
  drop: 'mark drop',
  clear: 'clear the roast',
  end: 'end the roast',
  'extend-cooling': 'add a minute of cooling',
  'cool-roaster': 'start cooling the drum',
  'stop-cooling-roaster': 'stop cooling the drum',
};

/** The toast when a flow button's call fails: "Couldn't mark drop · try again". */
export const roastActionFailed = (action: RoastAction): string =>
  `Couldn't ${WHAT[action]} · try again`;

/** The toast when main refuses it, as the roast has moved on: "Can't mark drop now". */
export const roastActionRefused = (action: RoastAction): string =>
  `Can't ${WHAT[action]} now · the roast has moved on`;
