import { describe, expect, it } from 'vitest';
import {
  AppInfoSchema,
  ReleasePageSchema,
  RestartToUpdateErrorSchema,
  UpdateStatusSchema,
  updateWaiting,
  type UpdateStatus,
} from './update-status';

const EVERY_STATE: UpdateStatus[] = [
  { state: 'off' },
  { state: 'idle', checkedAt: null },
  { state: 'idle', checkedAt: '2026-11-07T14:02:00.000Z' },
  { state: 'checking' },
  { state: 'downloading', version: '0.2.0', percent: 45 },
  { state: 'ready', version: '0.2.0' },
  { state: 'available', version: '0.2.0', reason: 'cant-replace' },
  { state: 'failed', stage: 'check' },
  { state: 'failed', stage: 'download' },
  { state: 'failed', stage: 'install' },
];

describe('UpdateStatusSchema', () => {
  it.each(EVERY_STATE)('round-trips %j', (status) => {
    expect(UpdateStatusSchema.parse(status)).toEqual(status);
  });

  it.each([
    { state: 'installing' },
    { state: 'idle' },
    { state: 'idle', checkedAt: 'yesterday' },
    { state: 'downloading', version: '0.2.0', percent: 140 },
    { state: 'downloading', version: '0.2.0', percent: -1 },
    { state: 'ready', version: '0.2.0-beta.1' },
    { state: 'available', version: 'latest' },
    { state: 'available' },
    { state: 'available', version: '0.2.0', reason: 'busy' },
    { state: 'failed', stage: 'unpack' },
    null,
  ])('rejects %j', (status) => {
    expect(UpdateStatusSchema.safeParse(status).success).toBe(false);
  });

  it('reads the older shapes: no reason means it cannot replace itself, no stage means the check', () => {
    expect(UpdateStatusSchema.parse({ state: 'available', version: '0.2.0' })).toEqual({
      state: 'available',
      version: '0.2.0',
      reason: 'cant-replace',
    });
    expect(UpdateStatusSchema.parse({ state: 'failed' })).toEqual({
      state: 'failed',
      stage: 'check',
    });
  });

  it('AppInfo carries the installed version and the status', () => {
    const info = { version: '0.1.0', update: { state: 'checking' } };
    expect(AppInfoSchema.parse(info)).toEqual(info);
  });
});

describe('updateWaiting', () => {
  it('is true only while an update is ready or out', () => {
    expect(EVERY_STATE.filter(updateWaiting).map((s) => s.state)).toEqual(['ready', 'available']);
    expect(updateWaiting({ state: 'failed', stage: 'install' })).toBe(false);
  });
});

describe('IPC payloads', () => {
  it('a release page is named, never given as an address', () => {
    expect(ReleasePageSchema.safeParse('installed').success).toBe(true);
    expect(ReleasePageSchema.safeParse('latest').success).toBe(true);
    expect(
      ReleasePageSchema.safeParse('https://github.com/mnabaci/Roastpilot/releases').success,
    ).toBe(false);
    expect(ReleasePageSchema.safeParse(undefined).success).toBe(false);
  });

  it('Restart to update errors say why', () => {
    for (const kind of ['roasting', 'not-ready', 'install-failed'])
      expect(RestartToUpdateErrorSchema.parse({ kind })).toEqual({ kind });
    expect(RestartToUpdateErrorSchema.safeParse({ kind: 'busy' }).success).toBe(false);
  });
});
