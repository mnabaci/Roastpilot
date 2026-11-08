export { ManualClock, type Clock } from './clock';
export { quantize } from './quantize';
export type { DriverError, RoasterDriver } from './roaster-driver';
export type { Transport, TransportError } from './transport';
export { SafetyGuardedDriver } from './safety/safety-guarded-driver';
export { DEFAULT_SAFETY_LIMITS, type SafetyLimits } from './safety/safety-limits';
export {
  COMPUTER_SLEEP,
  EMERGENCY_STOP,
  SafetyMonitor,
  type SafetyEvent,
  type SafetyMonitorOptions,
} from './safety/safety-monitor';
export {
  POLL_MS,
  RoasterSession,
  SAFE_STOP_TIMEOUT_MS,
  type RoasterSessionOptions,
} from './session/roaster-session';
export { fanOut, withMinLevel, type LogSink } from './logging/log-sink';
export { createLogger, silentLogger, type LogContext, type Logger } from './logging/logger';
export { serializeError, type SerializedError } from './logging/serialize-error';
export { FailureStreak } from './logging/failure-streak';
export {
  DEFAULT_COOLING_MS,
  EXTEND_COOLING_MS,
  FILTER_ON,
  ManualRoast,
  type ManualRoastDeps,
  type RoastOptions,
} from './roast/manual-roast';
export { CHARGE_LOOKBACK_MS, findChargePoint } from './roast/charge-point';
export { findTurningPoint } from './roast/turning-point';
export { DRUM_ON, drumOnValue } from './roast/roast-outputs';
export {
  DEFAULT_ROASTER_COOL_TO_C,
  ROASTER_COOL_AFTER_DROP_MAX_MS,
  ROASTER_COOL_MAX_MS,
  ROASTER_COOL_OFFER_ABOVE_C,
  roasterCooldownCheck,
} from './roast/roaster-cooldown';
export { rateOfRise, ROR_DRAW_LIMITS, ROR_WINDOW_MS, rorReadings } from './roast/rate-of-rise';
export { MAX_HISTORY_READINGS, ReadingHistory } from './roast/reading-history';
export type { SettingsStore } from './settings/settings-store';
export type {
  RoastRepository,
  RoastSummaryPatch,
  NewRoast,
  RoastPlan,
} from './history/roast-repository';
export { RoastRecorder, type RoastRecorderDeps } from './history/roast-recorder';
export { expectedFirstCrackC, type FirstCrackRoast } from './history/expected-first-crack';
export { AutoPilot, type AutoPilotDeps } from './auto/auto-pilot';
export type { AutoEvent } from './auto/roast-run';
export { Coach, type CoachClaimError, type CoachDeps } from './coach/coach';
export type { CoachInput, CoachRule, CoachTip } from './coach/coach-rule';
export { autoSettingRule } from './coach/setting-rule';
export { firstCrackSoonRule } from './coach/first-crack-soon-rule';
export { dropSoonRule } from './coach/drop-soon-rule';
export { curveTargetC, smoothCurve } from './auto/curve';
export { followAimRor } from './auto/follow-control';
export { STALL } from './auto/stall-guard';
export { plannedCurve } from './auto/steps-curve';
export { timeAtC } from './profiles/curve-time';
export {
  builderBase,
  milestonesFrom,
  profileFromMilestones,
} from './profiles/profile-from-milestones';
export { profileFromRoast, type ProfileStyle } from './profiles/profile-from-roast';
export type { ProfileRepository } from './profiles/profile-repository';
export type { RoasterRepository } from './roasters/roaster-repository';
export { CAP_BELOW_MAX_C, soakLengthS, withCapUnder } from './auto/phase-plan';
export {
  batchPlans,
  DEFAULT_LOSS_PCT,
  expectedRoastedG,
  type BatchPlans,
  type BatchSizes,
} from './beans/batch-plans';
export { beanHints } from './beans/bean-hints';
export type { BeanRepository } from './beans/bean-repository';
export {
  bestFavourite,
  defaultGhost,
  suggestProfile,
  type ProfileSuggestion,
} from './beans/suggest-profile';
export type { Updater, UpdaterEvent, UpdaterFailure } from './updates/updater';
export { UpdateService, type UpdateServiceDeps } from './updates/update-service';
export { CHECK_EVERY_MS, FIRST_CHECK_MS } from './updates/update-schedule';
export { isNewerVersion } from './updates/version';
export {
  DEFAULT_ROAST_END_S,
  expectedRoastEndS,
  plannedDropS,
  plannedTurningPointC,
} from './chart/roast-end';
export {
  FOCUS_AHEAD_S,
  FOCUS_BEFORE_CHARGE_S,
  focusWindow,
  savedRoastWindow,
  type TimeWindow,
} from './chart/focus-window';
export { PROJECTION_AHEAD_S, projection, type ProjectedPoint } from './chart/projection';
export { DEFAULT_DRY_END_C, phaseBandEdges, type PhaseBandEdges } from './chart/phase-bands';
export { savedTurningPointC, type TurningPointRoast } from './history/expected-turning-point';
export {
  DEFAULT_FLOOR_C,
  expectedTurningPointC,
  FLOOR_STEP_C,
  nextFloorC,
  startFloorC,
} from './chart/temperature-floor';
