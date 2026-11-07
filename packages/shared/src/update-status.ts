import { z } from 'zod';

/** A release version, `X.Y.Z` (no pre-releases: docs/spec/install-and-update.md). */
export const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

/** Why a newer version can't install by itself (macOS: move Roastpilot to Applications). */
export const UpdateBlockedReasonSchema = z.enum(['cant-replace']);

/** Which step failed: About says "Couldn't check" or "Couldn't update". */
export const UpdateStageSchema = z.enum(['check', 'download', 'install']);

/** Where updates are (docs/spec/install-and-update.md, What you see): one state, one line in About. */
export const UpdateStatusSchema = z.discriminatedUnion('state', [
  /** In development (`pnpm dev`): the updater is off. */
  z.object({ state: z.literal('off') }),
  /** Up to date as of `checkedAt` (ISO 8601); null before the first check. */
  z.object({ state: z.literal('idle'), checkedAt: z.iso.datetime().nullable() }),
  z.object({ state: z.literal('checking') }),
  /** A newer version is downloading in the background. */
  z.object({
    state: z.literal('downloading'),
    version: VersionSchema,
    percent: z.number().min(0).max(100),
  }),
  /** Downloaded (and on macOS checked); installs on quit, or Restart to update. */
  z.object({ state: z.literal('ready'), version: VersionSchema }),
  /**
   * A newer version is out but this copy can't install it (`reason`); Download opens its release
   * page. `cant-replace`: macOS, run from the DMG, a translocated copy or a folder it can't write.
   */
  z.object({
    state: z.literal('available'),
    version: VersionSchema,
    reason: UpdateBlockedReasonSchema.default('cant-replace'),
  }),
  /** The check, the download or the last install failed (logged in main); the next check tries again. */
  z.object({ state: z.literal('failed'), stage: UpdateStageSchema.default('check') }),
]);

/** What About shows: the installed version and where updates are. */
export const AppInfoSchema = z.object({
  version: z.string(),
  update: UpdateStatusSchema,
});

/** Restart to update was refused: a roast runs, nothing is ready, or the installer didn't start. */
export const RestartToUpdateErrorSchema = z.object({
  kind: z.enum(['roasting', 'not-ready', 'install-failed']),
});

/**
 * Which release page to open: the installed version's notes (What's new) or the newer one that is
 * out (Download). Main builds the address; the renderer never sends one.
 */
export const ReleasePageSchema = z.enum(['installed', 'latest']);

/** `no-release`: Download was asked for while no newer version is out. */
export const OpenReleasePageErrorSchema = z.object({
  kind: z.enum(['no-release', 'open-failed']),
});

export type UpdateStatus = z.infer<typeof UpdateStatusSchema>;
export type UpdateBlockedReason = z.infer<typeof UpdateBlockedReasonSchema>;
export type UpdateStage = z.infer<typeof UpdateStageSchema>;
export type AppInfo = z.infer<typeof AppInfoSchema>;
export type RestartToUpdateError = z.infer<typeof RestartToUpdateErrorSchema>;
export type ReleasePage = z.infer<typeof ReleasePageSchema>;
export type OpenReleasePageError = z.infer<typeof OpenReleasePageErrorSchema>;

/** Before main has said anything, and in development. */
export const UPDATES_OFF: UpdateStatus = { state: 'off' };

/** An update is waiting for you: the Settings tab carries a dot. */
export function updateWaiting(status: UpdateStatus): boolean {
  return status.state === 'ready' || status.state === 'available';
}
