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
export { AutoPilot, type AutoPilotDeps } from './auto/auto-pilot';
export type { AutoEvent } from './auto/roast-run';
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
export { withSoakTime } from './auto/phase-plan';
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
