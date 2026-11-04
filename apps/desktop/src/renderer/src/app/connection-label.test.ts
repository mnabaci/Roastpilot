import { describe, expect, it } from 'vitest';
import { targetLabel } from './connection-label';

describe('targetLabel', () => {
  it.each([
    [{ kind: 'simulator' } as const, 'Simulator'],
    [{ kind: 'serial', path: '/dev/cu.usbserial-0001' } as const, 'usbserial-0001'],
    [{ kind: 'serial', path: '/dev/tty.usbmodem14101' } as const, 'usbmodem14101'],
    [{ kind: 'serial', path: 'COM3' } as const, 'COM3'],
    [{ kind: 'serial', path: '\\\\.\\COM12' } as const, 'COM12'],
  ])('%o is %s', (target, label) => {
    expect(targetLabel(target)).toBe(label);
  });
});
