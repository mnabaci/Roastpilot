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
  ROASTER_COOL_C,
  ROASTER_COOL_MAX_MS,
  ROASTER_COOL_OFFER_C,
  roasterCooldownCheck,
} from './roast/roaster-cooldown';
export { rateOfRise, ROR_DRAW_LIMITS, ROR_WINDOW_MS, rorReadings } from './roast/rate-of-rise';
export { MAX_HISTORY_READINGS, ReadingHistory } from './roast/reading-history';
export type { SettingsStore } from './settings/settings-store';
export type { RoastRepository, RoastSummaryPatch } from './history/roast-repository';
export { RoastRecorder, type RoastRecorderDeps } from './history/roast-recorder';
