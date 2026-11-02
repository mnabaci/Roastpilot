import { describe, expect, it } from 'vitest';
import { ConnectTargetSchema } from './connection';
import { DriverErrorSchema } from './driver-error';
import { IPC_CHANNELS, SetOutputRequestSchema } from './ipc';
import { SafetyEventSchema } from './safety-event';

describe('IPC contract', () => {
  it('has a unique name for every channel', () => {
    const names = Object.values(IPC_CHANNELS);
    expect(new Set(names).size).toBe(names.length);
  });

  describe('ConnectTargetSchema', () => {
    it.each([
      { kind: 'serial', path: '/dev/cu.usbserial-0001' },
      { kind: 'serial', path: 'COM3' },
      { kind: 'simulator' },
    ])('accepts %j', (target) => {
      expect(ConnectTargetSchema.safeParse(target).success).toBe(true);
    });

    it.each([
      { kind: 'serial', path: '' },
      { kind: 'serial' },
      { kind: 'wifi' },
      null,
      'simulator',
    ])('rejects %j', (target) => {
      expect(ConnectTargetSchema.safeParse(target).success).toBe(false);
    });
  });

  describe('SetOutputRequestSchema', () => {
    it('accepts a channel and a number', () => {
      expect(SetOutputRequestSchema.safeParse({ channel: 'heater', value: 45 }).success).toBe(true);
    });

    it.each([
      { channel: 'heater', value: Number.NaN },
      { channel: 'heater', value: Number.POSITIVE_INFINITY },
      { channel: 'heater', value: '45' },
      { channel: '', value: 45 },
      { value: 45 },
    ])('rejects %j', (request) => {
      expect(SetOutputRequestSchema.safeParse(request).success).toBe(false);
    });
  });

  it('round-trips every driver error kind', () => {
    const errors = [
      { kind: 'disconnected' },
      { kind: 'no-reply', command: 'READ' },
      { kind: 'version-mismatch', expected: 1, actual: null },
      { kind: 'bad-reply', line: 'x' },
      { kind: 'unknown-channel', channel: 'boost' },
      { kind: 'safety-locked', channel: 'heater' },
    ];
    for (const error of errors) expect(DriverErrorSchema.parse(error)).toEqual(error);
  });

  it('rejects a safety event with an unknown action', () => {
    expect(
      SafetyEventSchema.safeParse({ kind: 'tripped', rule: 'x', action: 'panic', atMs: 0 }).success,
    ).toBe(false);
  });
});
