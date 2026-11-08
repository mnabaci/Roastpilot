import type {
  Bean,
  ProfileEntry,
  Roaster,
  RoastDetail,
  RoastSummary,
  Settings,
  Snapshot,
} from '@roastpilot/shared';

/** Everything a window asks main for, frozen at one moment: what a scene is drawn from. */
export interface AppState {
  snapshot: Snapshot;
  settings: Settings;
  profiles: ProfileEntry[];
  roasters: Roaster[];
  beans: Bean[];
  /** Newest first, as History lists them. */
  roasts: RoastSummary[];
  /** Every listed roast in full, for History, the ghost and the bean pages. */
  details: RoastDetail[];
}

/** The app at each moment the README shows. */
export interface SampleWorld {
  /** Connected to the Simulator and Ready, with past roasts saved. */
  idle: AppState;
  /** Six minutes into an Auto roast on Light · Curve, with the 5★ roast as its ghost. */
  auto: AppState;
  /** A manual roast in Maillard, with the coach suggesting heater and fan. */
  manual: AppState;
}
