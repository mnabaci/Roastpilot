export { ManualClock, type Clock } from './clock';
export { quantize } from './quantize';
export type { DriverError, RoasterDriver } from './roaster-driver';
export type { Transport, TransportError } from './transport';
export { SafetyGuardedDriver } from './safety/safety-guarded-driver';
export { DEFAULT_SAFETY_LIMITS } from './safety/safety-limits';
export {
  COMPUTER_SLEEP,
  EMERGENCY_STOP,
  SafetyMonitor,
  type SafetyEvent,
} from './safety/safety-monitor';
export { RoasterSession } from './session/roaster-session';
export { fanOut, withMinLevel, type LogSink } from './logging/log-sink';
export { createLogger, silentLogger, type Logger } from './logging/logger';
export { serializeError } from './logging/serialize-error';
export { FailureStreak } from './logging/failure-streak';
export { DEFAULT_COOLING_MS, FILTER_ON, ManualRoast } from './roast/manual-roast';
export { drumOnValue } from './roast/roast-outputs';
export { ROASTER_COOL_OFFER_ABOVE_C } from './roast/roaster-cooldown';
export { rateOfRise, ROR_DRAW_LIMITS, ROR_WINDOW_MS, rorReadings } from './roast/rate-of-rise';
export { MAX_HISTORY_READINGS, ReadingHistory } from './roast/reading-history';
export type { SettingsStore } from './settings/settings-store';
export type {
  RoastRepository,
  RoastSummaryPatch,
  NewRoast,
  RoastPlan,
} from './history/roast-repository';
export { RoastRecorder } from './history/roast-recorder';
export { expectedFirstCrackC } from './history/expected-first-crack';
export { AutoPilot } from './auto/auto-pilot';
export type { AutoEvent } from './auto/roast-run';
export { Coach } from './coach/coach';
export type { CoachRule } from './coach/coach-rule';
export { autoSettingRule } from './coach/setting-rule';
export { firstCrackSoonRule } from './coach/first-crack-soon-rule';
export { dropSoonRule } from './coach/drop-soon-rule';
export { curveTargetC, smoothCurve } from './auto/curve';
export { followAimRor } from './auto/follow-control';
export { PREHEAT } from './auto/preheat-protocol';
export { lastRoastEndMs, pickPreheatHold, type PreheatHold } from './auto/preheat-hold';
export { STALL } from './auto/stall-guard';
export { plannedCurve } from './auto/steps-curve';
export { timeAtC } from './profiles/curve-time';
export {
  builderBase,
  milestonesFrom,
  profileFromMilestones,
} from './profiles/profile-from-milestones';
export { profileFromRoast } from './profiles/profile-from-roast';
export type { ProfileRepository } from './profiles/profile-repository';
export type { RoasterRepository } from './roasters/roaster-repository';
export type { DriverDeps, RoasterModelDefinition } from './roasters/roaster-model-definition';
export { createDriver, newRoaster, roasterModels } from './roasters/roaster-models';
export { soakLengthS, withCapUnder } from './auto/phase-plan';
export { clampBatch, expectedRoastedG, splitStock } from './beans/batch-plans';
export { beanHints } from './beans/bean-hints';
export {
  stockSummary,
  stockTimeline,
  type StockStep,
  type StockSummary,
} from './beans/stock-history';
export type { BeanRepository } from './beans/bean-repository';
export { bestFavourite, defaultGhost, suggestProfile } from './beans/suggest-profile';
export type { Updater, UpdaterEvent } from './updates/updater';
export { UpdateService } from './updates/update-service';
export { FIRST_CHECK_MS } from './updates/update-schedule';
export { expectedRoastEndS, plannedDropS, plannedTurningPointC } from './chart/roast-end';
export { focusWindow, savedRoastWindow, type TimeWindow } from './chart/focus-window';
export { projection } from './chart/projection';
export { phaseBandEdges } from './chart/phase-bands';
export { savedTurningPointC } from './history/expected-turning-point';
export { expectedTurningPointC, nextFloorC, startFloorC } from './chart/temperature-floor';
