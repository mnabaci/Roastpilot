import { describe, expect, it } from 'vitest';
import { SIMULATOR, SKYWALKER } from '../test/roasters';
import { connectedName, targetLabel } from './connection-label';

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

describe('connectedName', () => {
  const port = { kind: 'serial', path: '/dev/cu.usbserial-0001' } as const;

  it('names the roaster record in use, not its port', () => {
    expect(connectedName(port, { ...SKYWALKER, name: 'My Skywalker' })).toBe('My Skywalker');
    expect(connectedName({ kind: 'simulator' }, { ...SIMULATOR, name: 'Practice' })).toBe(
      'Practice',
    );
  });

  it('falls back to the port when no record of that kind is active', () => {
    expect(connectedName(port, undefined)).toBe('usbserial-0001');
    expect(connectedName(port, SIMULATOR)).toBe('usbserial-0001');
    expect(connectedName({ kind: 'simulator' }, SKYWALKER)).toBe('Simulator');
  });
});
